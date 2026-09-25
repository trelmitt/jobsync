import "server-only";
import { generateText } from "ai";
import db from "@/lib/db";
import { getModel } from "@/lib/ai";
import { TEMPERATURES } from "@/lib/ai/config";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { COVER_LETTER_SYSTEM_PROMPT, buildCoverLetterPrompt } from "@/lib/ai/prompts/cover-letter";
import { extractMatchGuidance } from "@/lib/ai/coverLetter/matchGuidance";
import { stripThinking } from "@/lib/ai/stripThinking";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { saveCoverLetterForJob } from "@/lib/coverLetter/save";
import { getUserAiSettings } from "@/lib/scraper/automation-run/aiSettings";
import { tailorResumeForJob } from "@/lib/tailor/tailorResume";

type Log = (message: string, metadata?: Record<string, unknown>) => void;

// Runs before the fill when an application is started with prepare: tailor
// the resume, then write a cover letter. Each step is best-effort — a failure
// is logged and the fill still runs with the base resume — because the
// reviewer sees every step in the session log before anything is submitted.
export async function prepareApplication(applySessionId: string, log: Log): Promise<void> {
  const session = await db.applySession.findUniqueOrThrow({ where: { id: applySessionId } });
  const { jobId, userId, resumeId: baseResumeId } = session;

  log("Tailoring resume to this job");
  try {
    const tailored = await tailorResumeForJob(jobId, userId);
    await db.applySession.update({
      where: { id: applySessionId },
      data: { resumeId: tailored.resumeId },
    });
    log("Tailored resume ready", {
      summaryChanged: tailored.summaryChanged,
      groupsReordered: tailored.groupsReordered,
      keptOriginal: tailored.rejected,
    });
  } catch (error) {
    log("Tailoring skipped, using the base resume", { error: String(error) });
  }

  log("Writing cover letter");
  try {
    await writeCoverLetter(jobId, userId, baseResumeId);
    log("Cover letter saved to this job");
  } catch (error) {
    log("Cover letter skipped", { error: String(error) });
  }
}

// Written from the base resume: the tailored copy is a file with no sections,
// and the letter needs the structured resume text.
async function writeCoverLetter(jobId: string, userId: string, resumeId: string): Promise<void> {
  const jobLookup = await resolveJobForAgent(userId, jobId);
  if (jobLookup.status !== "ok") throw new Error("Job not found");
  const resumeLookup = await resolveResumeForAgent(userId, { pageResumeId: resumeId });
  if (resumeLookup.status !== "ok") throw new Error("Resume not found");

  const [resumePre, jobPre] = await Promise.all([
    preprocessResume(resumeLookup.resume),
    preprocessJob(jobLookup.job),
  ]);
  if (!resumePre.success) throw new Error("Resume has too little structured content for a letter");
  if (!jobPre.success) throw new Error("Job description is too short for a letter");

  const ai = await getUserAiSettings(userId);
  const result = await generateText({
    model: await getModel(ai.provider, ai.model || "llama3.2", userId),
    system: COVER_LETTER_SYSTEM_PROMPT,
    prompt: buildCoverLetterPrompt(
      resumePre.data.normalizedText,
      jobPre.data.normalizedText,
      extractMatchGuidance(jobLookup.job.matchData),
    ),
    temperature: TEMPERATURES.FEEDBACK,
  });
  await saveCoverLetterForJob(userId, jobId, stripThinking(result.text).trim());
}
