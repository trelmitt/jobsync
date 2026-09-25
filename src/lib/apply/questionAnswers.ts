import { generateText } from "ai";
import prisma from "@/lib/db";
import { getModel } from "@/lib/ai";
import { defaultUserSettings, type ApplyProfile } from "@/models/userSettings.model";
import type { FilledField } from "./types";

interface AnsweredQuestion {
  value: string;
  source: FilledField["source"];
}

// Loose word-overlap match, not embeddings — screening questions are short
// and the question bank is small (one user's own saved answers), so exact
// phrasing rarely matters as much as "have I answered something like this."
function overlapScore(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().match(/\w+/g) ?? []);
  const wordsB = new Set(b.toLowerCase().match(/\w+/g) ?? []);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared++;
  return shared / Math.min(wordsA.size, wordsB.size);
}

const MATCH_THRESHOLD = 0.6;

// Highest-stakes screening questions get an authoritative answer from the
// user's own applyProfile settings instead of a question-bank fuzzy-match or
// an AI guess — a wrong AI-guessed work-authorization or salary answer is a
// legal/reputational risk the plan explicitly calls out.
function answerFromApplyProfile(
  label: string,
  profile: ApplyProfile,
): string | null {
  if (/sponsorship/i.test(label) && profile.requiresSponsorship !== null) {
    return profile.requiresSponsorship ? "Yes" : "No";
  }
  if (/authoriz(ed|ation)\s+to\s+work|eligible\s+to\s+work/i.test(label) && profile.workAuthorized !== null) {
    return profile.workAuthorized ? "Yes" : "No";
  }
  if (/salary|compensation expectations|pay expectations/i.test(label) && profile.desiredSalary) {
    return profile.desiredSalary;
  }
  if (/notice period/i.test(label) && profile.noticePeriod) {
    return profile.noticePeriod;
  }
  return null;
}

export async function loadApplyProfile(userId: string): Promise<ApplyProfile> {
  const userSettings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!userSettings) return defaultUserSettings.applyProfile;
  return {
    ...defaultUserSettings.applyProfile,
    ...(JSON.parse(userSettings.settings).applyProfile ?? {}),
  };
}

export async function answerQuestion(
  label: string,
  userId: string,
): Promise<AnsweredQuestion | null> {
  const profile = await loadApplyProfile(userId);
  const fromProfile = answerFromApplyProfile(label, profile);
  if (fromProfile !== null) return { value: fromProfile, source: "profile" };

  const bank = await prisma.question.findMany({
    where: { createdBy: userId, answer: { not: null } },
  });

  let best: { answer: string; score: number } | null = null;
  for (const q of bank) {
    const score = overlapScore(label, q.question);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score) && q.answer) {
      best = { answer: q.answer, score };
    }
  }
  if (best) return { value: best.answer, source: "question_bank" };

  return draftAnswer(label, userId);
}

async function draftAnswer(
  label: string,
  userId: string,
): Promise<AnsweredQuestion | null> {
  try {
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    const ai = userSettings
      ? { ...defaultUserSettings.ai, ...(JSON.parse(userSettings.settings).ai ?? {}) }
      : defaultUserSettings.ai;

    const model = await getModel(ai.provider, ai.model || "llama3.2", userId);
    const result = await generateText({
      model,
      system:
        "You draft short, honest, first-person answers to job application " +
        "screening questions. Reply with only the answer text, no preamble, " +
        "under 80 words. If the question cannot be answered generically, " +
        "reply with exactly: SKIP.",
      prompt: `Screening question: "${label}"`,
      temperature: 0.4,
    });

    const text = result.text.trim();
    if (!text || text === "SKIP") return null;

    // Saved back tagged as apply-engine provenance so it shows up in the
    // Questions UI as an unreviewed, AI-drafted answer rather than silently
    // blending in with Trevor's own saved answers.
    await prisma.question.create({
      data: {
        question: label,
        answer: text,
        createdBy: userId,
        createdVia: "apply-engine",
      },
    });

    return { value: text, source: "ai_draft" };
  } catch {
    return null;
  }
}
