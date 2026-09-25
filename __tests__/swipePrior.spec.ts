import { buildSwipePrior, type Swipe } from "@/lib/scraper/ats/swipePrior";
import { runAtsPipeline } from "@/lib/scraper/ats/pipeline";
import type { JobDetails } from "@/lib/scraper/types";

const swipes = (title: string, accepted: boolean, n: number): Swipe[] =>
  Array.from({ length: n }, () => ({ title, accepted }));

const history = [
  ...swipes("Commercial Account Executive", true, 12),
  ...swipes("Senior Product Marketing Manager", false, 40),
];

describe("buildSwipePrior", () => {
  it("is null without enough accepts and dismisses", () => {
    expect(buildSwipePrior(swipes("Account Executive", true, 30))).toBeNull();
    expect(buildSwipePrior([...swipes("AE", true, 9), ...swipes("PM", false, 50)])).toBeNull();
  });

  it("ranks titles like accepted jobs up and dismissed ones down, within the cap", () => {
    const prior = buildSwipePrior(history)!;
    expect(prior("Commercial AE, Midwest")).toBeGreaterThan(0);
    expect(prior("Product Marketing Lead")).toBeLessThan(0);
    expect(prior("Chef")).toBe(0);
    expect(Math.abs(prior("Commercial Account Executive"))).toBeLessThanOrEqual(0.15);
  });

  it("leaves the automation's own target words alone", () => {
    const prior = buildSwipePrior(history, ["Product Marketing"])!;
    expect(prior("Product Marketing Lead")).toBe(0);
  });
});

describe("runAtsPipeline prior", () => {
  const job = (title: string): JobDetails => ({
    title,
    company: "Acme",
    location: "",
    description: "",
    url: `https://example.com/${title}`,
  });
  const config = { targetTitles: ["Manager"], keywords: [], locations: [], strictLocation: false };
  const jobs = [job("Product Manager"), job("Account Manager"), job("Cook")];

  it("reorders the LLM budget without changing who survives", () => {
    const plain = runAtsPipeline(jobs, config, [], { k: 1 });
    const prior = (title: string) => (title.startsWith("Account") ? 0.1 : 0);
    const nudged = runAtsPipeline(jobs, config, [], { k: 1, prior });
    expect(nudged.toAnalyze.map((s) => s.job.title)).toEqual(["Account Manager"]);
    expect(nudged.funnel).toEqual(plain.funnel);
    const plainAccount = [...plain.toAnalyze, ...plain.toSaveUnanalyzed].find(
      (s) => s.job.title === "Account Manager",
    )!;
    expect(nudged.toAnalyze[0].score).toBe(plainAccount.score); // stored score stays lexical
  });
});
