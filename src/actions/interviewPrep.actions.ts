"use server";
import MarkdownIt from "markdown-it";
import { generateText } from "ai";
import prisma from "@/lib/db";
import { getModel } from "@/lib/ai";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { APP_CONSTANTS } from "@/lib/constants";
import { handleError } from "@/lib/utils";
import { stripThinking } from "@/lib/ai/stripThinking";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { INTERVIEW_PREP_SYSTEM_PROMPT, buildInterviewPrepPrompt } from "@/lib/ai/prompts/interview-prep";
import { getDefaultModelForProvider, getUserAiSettings } from "@/lib/scraper/automation-run/aiSettings";
import { requireUser } from "./shared";

// html:false escapes any raw HTML in the model output before it is stored.
const md = new MarkdownIt({ html: false, linkify: false, breaks: true });

// Saved as a note on the job so it's editable and sits with the rest of the
// job's history.
export const generateInterviewPrep = async (jobId: string): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    if (!checkRateLimit(user.id).allowed) throw new Error("Too many AI requests. Try again in a minute.");
    const jobLookup = await resolveJobForAgent(user.id, jobId);
    if (jobLookup.status === "no_job") throw new Error("Job not found");
    const job = jobLookup.job;
    if (job.descriptionCompleteness === "title-only") throw new Error("Add a job description first");

    const resumeLookup = await resolveResumeForAgent(user.id, { pageResumeId: job.resumeId ?? undefined });
    if (resumeLookup.status !== "ok") throw new Error("Set a default resume first (Profile → Resumes)");

    const [resumePre, jobPre] = await Promise.all([preprocessResume(resumeLookup.resume), preprocessJob(job)]);
    if (!jobPre.success) throw new Error("The job description is too short to prep from");
    if (!resumePre.success) throw new Error("Your resume needs more filled-in sections to prep from");

    const ai = await getUserAiSettings(user.id);
    const result = await generateText({
      model: await getModel(ai.provider, ai.model || getDefaultModelForProvider(ai.provider), user.id),
      system: INTERVIEW_PREP_SYSTEM_PROMPT,
      prompt: buildInterviewPrepPrompt(resumePre.data.normalizedText, jobPre.data.normalizedText),
      temperature: 0.4,
      // Same context window as the other resume + posting prompts; Ollama's
      // 2048 default would cut the resume or the tail of the pack.
      providerOptions: { ollama: { options: { num_ctx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX } } },
      // Output is match-sized (six sections), not letter-sized.
      abortSignal: AbortSignal.timeout(APP_CONSTANTS.AI_JOB_MATCH_TIMEOUT_MS),
    });
    const prep = stripThinking(result.text).trim();
    if (prep.length < 200) throw new Error("The prep came back empty. Try again.");

    const note = await prisma.note.create({
      data: {
        jobId: job.id!,
        userId: user.id,
        content: md.render(
          `## Interview prep\n\n_A draft from your resume and this posting: check every fact before you rely on it._\n\n${prep}`,
        ),
      },
    });
    return { success: true, data: { id: note.id } };
  } catch (error) {
    return handleError(error, "Failed to build interview prep.");
  }
};
