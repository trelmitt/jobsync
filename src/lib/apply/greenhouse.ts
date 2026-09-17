import type { Page } from "playwright-core";
import type { ApplyAdapter, ApplyContext, ApplyResult, FilledField } from "./types";
import { fillLabeledText, fillLabeledFile, answerDiscoveredQuestions } from "./fields";

export const greenhouseAdapter: ApplyAdapter = {
  platform: "greenhouse",

  matches: (url) => /(boards|job-boards)\.greenhouse\.io/.test(url),

  fill: async (page: Page, ctx: ApplyContext): Promise<ApplyResult> => {
    const filled: FilledField[] = [];

    await fillLabeledText(page, "First Name", ctx.applicantName.first, filled, "profile");
    await fillLabeledText(page, "Last Name", ctx.applicantName.last, filled, "profile");
    await fillLabeledText(page, "Email", ctx.email, filled, "profile");
    if (ctx.phone) await fillLabeledText(page, "Phone", ctx.phone, filled, "profile");
    await fillLabeledFile(page, "Resume", ctx.resumeFilePath, filled);

    // Any other visible text-like input becomes a screening question — the
    // handful above are already filled and re-matching them is a no-op since
    // fillLabeledText/fillLabeledFile already advanced the field's value.
    const questions = await page
      .locator("label")
      .evaluateAll((labels) =>
        labels
          .map((el) => el.textContent?.trim())
          .filter((text): text is string => !!text),
      );

    const knownLabels = new Set(["First Name", "Last Name", "Email", "Phone", "Resume"]);
    const discovered = questions
      .filter((label) => !knownLabels.has(label))
      .map((label) => ({ label, field: page.getByLabel(label, { exact: false }).first() }));

    await answerDiscoveredQuestions(discovered, ctx, filled);

    return { fieldsFilled: filled, screenshotPaths: [] };
  },

  submit: async (page: Page): Promise<void> => {
    await page.getByRole("button", { name: /submit application/i }).click();
  },
};
