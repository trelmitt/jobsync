import type { BrowserContext, Page } from "playwright-core";
import { getBrowser } from "./browser";
import db from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";

interface LiveSession {
  context: BrowserContext;
  page: Page;
  expiresAt: number;
}

// The live Page/BrowserContext for a fill-and-review attempt. This is
// deliberately NOT persisted anywhere — the ApplySession Prisma row is the
// durable record, but the actual browser handle only ever lives in this
// process's memory. A server restart between "filled" and "Trevor clicks
// submit" loses it by design; the UI's Refill button re-runs the fill.
declare const globalThis: {
  applyLiveSessionsGlobal?: Map<string, LiveSession>;
} & typeof global;

function store(): Map<string, LiveSession> {
  if (!globalThis.applyLiveSessionsGlobal) {
    globalThis.applyLiveSessionsGlobal = new Map();
  }
  return globalThis.applyLiveSessionsGlobal;
}

export async function openLiveSession(
  applySessionId: string,
  ttlMs: number,
): Promise<Page> {
  await closeLiveSession(applySessionId);

  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  store().set(applySessionId, { context, page, expiresAt: Date.now() + ttlMs });
  return page;
}

export function getLivePage(applySessionId: string): Page | undefined {
  const session = store().get(applySessionId);
  if (!session) return undefined;
  if (Date.now() > session.expiresAt) {
    void closeLiveSession(applySessionId);
    return undefined;
  }
  return session.page;
}

export async function closeLiveSession(applySessionId: string): Promise<void> {
  const session = store().get(applySessionId);
  if (!session) return;
  store().delete(applySessionId);
  await session.context.close().catch(() => {});
}

// Sweeps expired live sessions (TTL passed but nobody polled getLivePage to
// trigger the lazy check above). Called opportunistically from the start
// route rather than on a timer — same "reap on next access" shape as
// reapStaleRuns, just without a cron since ApplySession TTLs are minutes,
// not hours.
export async function reapExpiredLiveSessions(): Promise<void> {
  const now = Date.now();
  for (const [id, session] of store()) {
    if (now > session.expiresAt) {
      await closeLiveSession(id);
    }
  }
}

// A hard-killed process (deploy/OOM/crash) leaves an ApplySession row stuck
// in "queued"/"filling" forever, permanently blocking the one-active-session-
// per-job unique index for that job. Marks anything past its TTL as expired.
export async function reapStaleApplySessions(): Promise<void> {
  const cutoff = new Date(Date.now() - APP_CONSTANTS.APPLY_SESSION_TTL_MS);
  await db.applySession.updateMany({
    where: { status: { in: ["queued", "filling"] }, createdAt: { lt: cutoff } },
    data: { status: "expired" },
  });
}
