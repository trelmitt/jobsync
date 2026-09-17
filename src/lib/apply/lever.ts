import type { Page } from "playwright-core";
import type { ApplyAdapter, ApplyContext, ApplyResult, FilledField } from "./types";
import { fillLabeledText, fillLabeledFile, answerDiscoveredQuestions } from "./fields";

export const leverAdapter: ApplyAdapter = {
  platform: "lever",

  matches: (url) => /jobs\.lever\.co/.test(url),

  fill: async (page: Page, ctx: ApplyContext): Promise<ApplyResult> => {
    const filled: FilledField[] = [];

    // Lever uses a single combined name field, unlike Greenhouse's split
    // First/Last — everything else routes through the same shared helpers.
    const fullName = `${ctx.applicantName.first} ${ctx.applicantName.last}`.trim();
    await fillLabeledText(page, "Full name", fullName, filled, "profile");
    await fillLabeledText(page, "Email", ctx.email, filled, "profile");
    if (ctx.phone) await fillLabeledText(page, "Phone", ctx.phone, filled, "profile");
    await fillLabeledFile(page, "Resume/CV", ctx.resumeFilePath, filled);

    const labels = await page
      .locator("label")
      .evaluateAll((els) =>
        els.map((el) => el.textContent?.trim()).filter((t): t is string => !!t),
      );

    const knownLabels = new Set(["Full name", "Email", "Phone", "Resume/CV"]);
    const discovered = labels
      .filter((label) => !knownLabels.has(label))
      .map((label) => ({ label, field: page.getByLabel(label, { exact: false }).first() }));

    await answerDiscoveredQuestions(discovered, ctx, filled);

    return { fieldsFilled: filled, screenshotPaths: [] };
  },

  submit: async (page: Page): Promise<void> => {
    await page.getByRole("button", { name: /submit application/i }).click();
  },
};
