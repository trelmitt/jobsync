import fs from "fs/promises";
import path from "path";
import db from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";
import { automationLogger } from "@/lib/automation-logger";
import { resumeDetailInclude } from "@/lib/jobs/resumeDetailInclude";
import { detectPlatform, getApplyAdapter } from "./registry";
import { openLiveSession, getLivePage, closeLiveSession } from "./session";
import { prepareApplication } from "./prepare";
import { ASSIST_PLATFORM, buildAnswerSheet } from "./assist";
import type { ApplyContext, BlockedReason } from "./types";
import type { JobBoard } from "@/models/automation.model";

export class ApplySessionAlreadyRunningError extends Error {
  constructor() {
    super("An apply session is already in progress for this job");
    this.name = "ApplySessionAlreadyRunningError";
  }
}

export function screenshotsDir(): string {
  return path.join(APP_CONSTANTS.UPLOADS_DIR, "files", "apply-screenshots");
}

export function isApplyScreenshotPath(filePath: string): boolean {
  return path.resolve(filePath).startsWith(path.resolve(screenshotsDir()) + path.sep);
}

async function saveScreenshot(applySessionId: string, bytes: Buffer): Promise<string> {
  const dir = screenshotsDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${applySessionId}-${Date.now()}.png`);
  await fs.writeFile(filePath, bytes);
  return filePath;
}

// Creates the queued row and kicks off the fill in the background — mirrors
// the automations run route's fire-and-forget shape. Throws
// ApplySessionAlreadyRunningError on the partial-unique-index collision
// (one active session per job) instead of a pre-check race.
export async function startApplySession(
  jobId: string,
  userId: string,
  resumeId: string,
  // Tailor the resume and write a cover letter before filling.
  { prepare = false }: { prepare?: boolean } = {},
): Promise<{ id: string }> {
  const job = await db.job.findFirst({ where: { id: jobId, userId } });
  if (!job?.jobUrl) {
    throw new Error("Job has no application URL");
  }
  // The resumeId comes from the client; its ContactInfo is what gets typed
  // into the employer's form, so it must be the user's own.
  const resume = await db.resume.findFirst({ where: { id: resumeId, profile: { userId } }, select: { id: true } });
  if (!resume) {
    throw new Error("Resume not found");
  }

  // Only the prep pipeline falls back to assist; a plain fill needs an adapter.
  const platform = detectPlatform(job.jobUrl) ?? (prepare ? ASSIST_PLATFORM : null);
  if (!platform) {
    throw new Error("No apply adapter for this job's platform");
  }

  let session;
  try {
    session = await db.applySession.create({
      data: {
        jobId,
        userId,
        resumeId,
        platform,
        applicationUrl: job.jobUrl,
        status: "queued",
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApplySessionAlreadyRunningError();
    }
    throw error;
  }

  void runFill(session.id, prepare).catch((error) => {
    automationLogger.log(session.id, "error", "Apply session crashed", {
      error: String(error),
    });
  });

  return { id: session.id };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function runFill(applySessionId: string, prepare: boolean): Promise<void> {
  automationLogger.startRun(applySessionId);
  const log = (message: string, metadata?: Record<string, unknown>) =>
    automationLogger.log(applySessionId, "info", message, metadata);

  try {
    await db.applySession.update({
      where: { id: applySessionId },
      data: { status: "filling", startedAt: new Date() },
    });

    if (prepare) await prepareApplication(applySessionId, log);

    const session = await db.applySession.findUniqueOrThrow({
      where: { id: applySessionId },
      include: { Resume: { include: resumeDetailInclude } },
    });

    if (session.platform === ASSIST_PLATFORM) {
      await db.applySession.update({
        where: { id: applySessionId },
        data: {
          status: "needs_review",
          filledAt: new Date(),
          fieldsFilled: JSON.stringify(await buildAnswerSheet(session.userId, session.resumeId)),
        },
      });
      log("No auto-fill for this site: answer sheet ready to paste");
      return;
    }

    const adapter = getApplyAdapter(session.platform as JobBoard);
    if (!adapter) throw new Error(`No adapter for platform ${session.platform}`);

    const contact = session.Resume.ContactInfo;
    if (!contact) throw new Error("Resume has no contact info");
    const resumeFilePath = session.Resume.File?.filePath;
    if (!resumeFilePath) throw new Error("Resume has no attached file");

    const ctx: ApplyContext = {
      applySessionId,
      userId: session.userId,
      resumeFilePath,
      applicantName: { first: contact.firstName, last: contact.lastName },
      email: contact.email,
      phone: contact.phone,
      log,
    };

    const page = await openLiveSession(applySessionId, APP_CONSTANTS.APPLY_SESSION_TTL_MS);

    log("Navigating to application page", { url: session.applicationUrl });
    await page.goto(session.applicationUrl, { waitUntil: "domcontentloaded" });

    if (await isCaptchaPresent(page)) {
      await finishAsBlocked(applySessionId, "captcha_detected");
      return;
    }

    const result = await adapter.fill(page, ctx);
    const screenshotPath = await saveScreenshot(applySessionId, await page.screenshot());

    await db.applySession.update({
      where: { id: applySessionId },
      data: {
        status: "needs_review",
        filledAt: new Date(),
        expiresAt: new Date(Date.now() + APP_CONSTANTS.APPLY_SESSION_TTL_MS),
        fieldsFilled: JSON.stringify(result.fieldsFilled),
        screenshotPaths: JSON.stringify([screenshotPath]),
      },
    });
    log("Fill complete, awaiting review");
  } catch (error) {
    await closeLiveSession(applySessionId);
    await db.applySession.update({
      where: { id: applySessionId },
      data: { status: "failed", errorMessage: String(error) },
    });
    log("Fill failed", { error: String(error) });
  } finally {
    automationLogger.endRun(applySessionId);
  }
}

async function isCaptchaPresent(page: Awaited<ReturnType<typeof openLiveSession>>): Promise<boolean> {
  const frames = page.frames().map((f) => f.url());
  return frames.some((url) => /recaptcha|hcaptcha|captcha/i.test(url));
}

async function finishAsBlocked(applySessionId: string, reason: BlockedReason): Promise<void> {
  await closeLiveSession(applySessionId);
  await db.applySession.update({
    where: { id: applySessionId },
    data: { status: "blocked", blockedReason: reason },
  });
  automationLogger.log(applySessionId, "warning", "Blocked", { reason });
}

// The ONLY code path allowed to click a real Submit button — see
// src/app/api/apply/[id]/submit/route.ts, the sole caller.
export async function submitApplySession(applySessionId: string): Promise<void> {
  const session = await db.applySession.findUniqueOrThrow({ where: { id: applySessionId } });
  if (session.status !== "needs_review") {
    throw new Error(`Cannot submit a session in status ${session.status}`);
  }

  // Assist sessions have no browser: Trevor applied on the site himself, and
  // this click only records that he did.
  if (session.platform === ASSIST_PLATFORM) {
    await markSubmitted(applySessionId, session.jobId);
    return;
  }

  const page = getLivePage(applySessionId);
  if (!page) {
    await db.applySession.update({
      where: { id: applySessionId },
      data: { status: "expired" },
    });
    throw new Error("Review session expired — refill and try again");
  }

  const adapter = getApplyAdapter(session.platform as JobBoard);
  if (!adapter) throw new Error(`No adapter for platform ${session.platform}`);

  await adapter.submit(page);
  await markSubmitted(applySessionId, session.jobId);
  await closeLiveSession(applySessionId);
}

async function markSubmitted(applySessionId: string, jobId: string): Promise<void> {
  await db.applySession.update({
    where: { id: applySessionId },
    data: { status: "submitted", submittedAt: new Date() },
  });
  const appliedStatus = await db.jobStatus.findFirst({ where: { value: "applied" } });
  await db.job.update({
    where: { id: jobId },
    data: { applied: true, appliedDate: new Date(), ...(appliedStatus && { statusId: appliedStatus.id }) },
  });
}

export async function cancelApplySession(applySessionId: string): Promise<void> {
  await closeLiveSession(applySessionId);
  await db.applySession.update({
    where: { id: applySessionId },
    data: { status: "cancelled" },
  });
}
