import type { Page, Locator } from "playwright-core";
import { isEeoField } from "./eeoDenylist";
import { pacedDelay } from "./pacing";
import type { ApplyContext, FilledField } from "./types";

// Fills a text-like input found by its associated <label> text, skipping
// EEO/self-ID fields per the hard denylist. Missing fields are silently
// skipped (not every board asks every question) rather than failing the run.
export async function fillLabeledText(
  page: Page,
  label: string,
  value: string | undefined,
  filled: FilledField[],
  source: FilledField["source"],
): Promise<void> {
  if (!value) return;

  if (isEeoField(label)) {
    filled.push({ label, value: "(left blank — self-identification field)", source: "skipped_eeo" });
    return;
  }

  const field = page.getByLabel(label, { exact: false }).first();
  if ((await field.count()) === 0) return;

  await field.fill(value);
  await pacedDelay();
  filled.push({ label, value, source });
}

export async function fillLabeledFile(
  page: Page,
  label: string,
  filePath: string,
  filled: FilledField[],
): Promise<void> {
  const field = page.getByLabel(label, { exact: false }).first();
  if ((await field.count()) === 0) return;

  await field.setInputFiles(filePath);
  await pacedDelay();
  filled.push({ label, value: filePath, source: "resume" });
}

// Screening questions vary per-listing, so adapters hand back every
// question-like field they find and let questionAnswers.ts decide how to
// answer each one (question bank match, then AI draft, then left for review).
export interface DiscoveredQuestion {
  label: string;
  field: Locator;
}

export async function answerDiscoveredQuestions(
  questions: DiscoveredQuestion[],
  ctx: ApplyContext,
  filled: FilledField[],
): Promise<void> {
  const { answerQuestion } = await import("./questionAnswers");

  for (const { label, field } of questions) {
    if (isEeoField(label)) {
      filled.push({ label, value: "(left blank — self-identification field)", source: "skipped_eeo" });
      continue;
    }

    const answered = await answerQuestion(label, ctx.userId);
    if (!answered) continue;

    if ((await field.count()) === 0) continue;
    await field.fill(answered.value);
    await pacedDelay();
    filled.push({ label, value: answered.value, source: answered.source });
  }
}
