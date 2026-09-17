import type { Page } from "playwright-core";
import type { ApplyAdapter, ApplyContext, ApplyResult, FilledField } from "./types";
import { fillLabeledText, fillLabeledFile, answerDiscoveredQuestions } from "./fields";

export const ashbyAdapter: ApplyAdapter = {
  platform: "ashby",

  matches: (url) => /jobs\.ashbyhq\.com/.test(url),

  fill: async (page: Page, ctx: ApplyContext): Promise<ApplyResult> => {
    const filled: FilledField[] = [];

    await fillLabeledText(page, "Name", `${ctx.applicantName.first} ${ctx.applicantName.last}`.trim(), filled, "profile");
    await fillLabeledText(page, "Email", ctx.email, filled, "profile");
    if (ctx.phone) await fillLabeledText(page, "Phone", ctx.phone, filled, "profile");
    await fillLabeledFile(page, "Resume", ctx.resumeFilePath, filled);

    const labels = await page
      .locator("label")
      .evaluateAll((els) =>
        els.map((el) => el.textContent?.trim()).filter((t): t is string => !!t),
      );

    const knownLabels = new Set(["Name", "Email", "Phone", "Resume"]);
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
