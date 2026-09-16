import { generateText } from "ai";
import {
  getModel,
  parseJobMatch,
  parseJobFacts,
  AUTOMATION_JOB_MATCH_SYSTEM_PROMPT,
  buildAutomationJobMatchPrompt,
  OPPORTUNITY_FIT_SYSTEM_PROMPT,
  buildOpportunityFitPrompt,
  removeHtmlTags,
} from "@/lib/ai";
import { APP_CONSTANTS } from "@/lib/constants";
import type { JobBoard } from "@/models/automation.model";
import type { AiSettings, JobPreferences } from "@/models/userSettings.model";
import {
  genAiRequestAttrs,
  genAiResponseAttrs,
  inputSizeAttrs,
  log,
  SURFACES,
  withSpan,
} from "@/lib/telemetry";
import type { JobDetails } from "../types";
import type { ResumeWithSections } from "./types";
import { getDefaultModelForProvider } from "./aiSettings";
import { convertResumeForMatch } from "./resumeText";

export interface MatchResult {
  success: boolean;
  score: number;
  data?: object;
  error?: string;
}

export async function matchJobToResume(
  job: JobDetails,
  resume: ResumeWithSections,
  sourceBoard: JobBoard,
  aiSettings: AiSettings,
  userId: string,
  signal?: AbortSignal,
  jobPreferences?: JobPreferences,
): Promise<MatchResult> {
  try {
    const resumeText = await convertResumeForMatch(resume);
    const jobText = `
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
${job.salary ? `Salary: ${job.salary}` : ""}

Description:
${removeHtmlTags(job.description)}
`.trim();

    const provider = aiSettings.provider;
    const modelName = aiSettings.model || getDefaultModelForProvider(provider);
    const model = await getModel(provider, modelName, userId);

    const promptText = buildAutomationJobMatchPrompt(resumeText, jobText);

    const result = await withSpan(
      "scraper.match",
      {
        ...genAiRequestAttrs({
          provider,
          model: modelName,
          temperature: 0.3,
          numCtx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX,
          surface: SURFACES.AUTOMATION_MATCH,
          system: AUTOMATION_JOB_MATCH_SYSTEM_PROMPT,
          prompt: promptText,
        }),
        ...inputSizeAttrs({
          resumeChars: resumeText.length,
          jobChars: jobText.length,
        }),
        "jobsync.job_board": sourceBoard,
        "jobsync.user_id": userId,
      },
      async (span) => {
        const generated = await generateText({
          model,
          system: AUTOMATION_JOB_MATCH_SYSTEM_PROMPT,
          prompt: promptText,
          temperature: 0.3,
          abortSignal: signal,
        });
        span.setAttrs(
          genAiResponseAttrs({
            usage: generated.totalUsage,
            finishReason: generated.finishReason,
            text: generated.text,
          }),
        );
        return generated;
      },
    );

    const { scores, body: rawBody } = parseJobMatch(result.text);
    if (!scores) {
      return { success: false, score: 0, error: "No match data returned" };
    }
    const { facts, body } = parseJobFacts(rawBody);

    const skillScore = scores.matchScore;
    const opportunityProfile = jobPreferences?.opportunityProfile?.trim();
    const opportunityWeight = jobPreferences?.opportunityWeight ?? 0;

    // Opportunity fit is an optional second opinion (candidate priorities like
    // company stage/AI focus/equity, not skills). Skip the extra LLM call
    // entirely when the candidate hasn't opted in — zero cost/behavior change
    // for anyone who leaves the preference blank.
    if (!opportunityProfile || opportunityWeight <= 0) {
      return {
        success: true,
        score: skillScore,
        data: { matchScore: skillScore, recommendation: scores.recommendation, body, facts },
      };
    }

    try {
      const opportunityPrompt = buildOpportunityFitPrompt(jobText, opportunityProfile);
      const opportunityResult = await withSpan(
        "scraper.match.opportunity",
        {
          ...genAiRequestAttrs({
            provider,
            model: modelName,
            temperature: 0.3,
            numCtx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX,
            surface: SURFACES.AUTOMATION_MATCH,
            system: OPPORTUNITY_FIT_SYSTEM_PROMPT,
            prompt: opportunityPrompt,
          }),
          "jobsync.job_board": sourceBoard,
          "jobsync.user_id": userId,
        },
        async (span) => {
          const generated = await generateText({
            model,
            system: OPPORTUNITY_FIT_SYSTEM_PROMPT,
            prompt: opportunityPrompt,
            temperature: 0.3,
            abortSignal: signal,
          });
          span.setAttrs(
            genAiResponseAttrs({
              usage: generated.totalUsage,
              finishReason: generated.finishReason,
              text: generated.text,
            }),
          );
          return generated;
        },
      );
      const parsedOpportunity = parseJobMatch(opportunityResult.text);
      if (!parsedOpportunity.scores) throw new Error("No opportunity score returned");

      const opportunityScore = parsedOpportunity.scores.matchScore;
      const weight = Math.min(100, Math.max(0, opportunityWeight)) / 100;
      const blended = Math.round(skillScore * (1 - weight) + opportunityScore * weight);

      return {
        success: true,
        score: blended,
        data: {
          matchScore: blended,
          recommendation: scores.recommendation,
          body,
          facts,
          skillScore,
          opportunityScore,
          opportunityRecommendation: parsedOpportunity.scores.recommendation,
          opportunitySummary: parsedOpportunity.body,
          opportunityWeight,
        },
      };
    } catch (opportunityError) {
      // The opportunity pass is an enhancement, not a requirement — fall back
      // to the skill-only score rather than failing the whole match.
      log.error("[Automation] Opportunity-fit matching error", {
        error:
          opportunityError instanceof Error
            ? opportunityError.message
            : String(opportunityError),
      });
      return {
        success: true,
        score: skillScore,
        data: { matchScore: skillScore, recommendation: scores.recommendation, body, facts },
      };
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      return { success: false, score: 0, error: "aborted" };
    }

    const message =
      error instanceof Error ? error.message : "AI matching failed";
    log.error("[Automation] AI matching error", { error: message });

    if (
      message.includes("ECONNREFUSED") ||
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("Failed to fetch") ||
      message.includes("ENOTFOUND")
    ) {
      return { success: false, score: 0, error: "ai_unavailable" };
    }

    return { success: false, score: 0, error: message };
  }
}
