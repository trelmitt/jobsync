import { stripThinking } from "@/lib/ai/stripThinking";
import type { DocxStructure } from "./docx";

export const TAILOR_SYSTEM_PROMPT =
  "You tailor a resume to one job posting WITHOUT changing any facts. " +
  "Rewrite the summary to lead with what this job wants by reordering, trimming, and lightly rewording " +
  "the resume's own sentences. Use only words and facts already in the resume: never add numbers, " +
  "employers, tools, skills, or claims that are not in it, and never describe the candidate with " +
  "the job's title. " +
  "Reorder each bullet group so the most relevant bullet comes first; keep every bullet. " +
  "Reply with only JSON, no prose.";

export function parseTailorJson(text: string): unknown {
  const body = stripThinking(text);
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function buildTailorPrompt(structure: DocxStructure, jobTitle: string, company: string, description: string) {
  const summary =
    structure.summaryIndex !== null ? structure.texts[structure.summaryIndex] : "(none)";
  const groups = structure.groups
    .map(
      (group, g) =>
        `Group ${g}:\n` + group.map((p, i) => `[${i}] ${structure.texts[p]}`).join("\n"),
    )
    .join("\n\n");
  return (
    `JOB: ${jobTitle} at ${company}\n${description.slice(0, 6000)}\n\n` +
    `SUMMARY:\n${summary}\n\nBULLET GROUPS:\n${groups}\n\n` +
    `Reply with JSON: {"summary": "<rewritten summary, 2-4 sentences>", ` +
    `"orders": [<for each group, the bullet indices in the new order>]}`
  );
}
