import { buildSwipePrior, isUserSwipe, type Swipe } from "@/lib/scraper/ats/swipePrior";
import { runAtsPipeline } from "@/lib/scraper/ats/pipeline";
import type { JobDetails } from "@/lib/scraper/types";
import { APP_CONSTANTS } from "@/lib/constants";

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

  it("ranks titles like dismissed jobs down, within the cap, and never boosts", () => {
    const prior = buildSwipePrior(history)!;
    expect(prior("Product Marketing Lead")).toBeLessThan(0);
    expect(prior("Senior Product Marketing Manager")).toBeGreaterThanOrEqual(-0.15);
    expect(prior("Commercial Account Executive")).toBe(0);
    expect(prior("Chef")).toBe(0);
  });

  it("leaves the automation's own target words alone", () => {
    const prior = buildSwipePrior(history, ["Product Marketing"])!;
    expect(prior("Product Marketing Lead")).toBe(0);
  });
});

describe("isUserSwipe", () => {
  const row = (discoveryStatus: string, matchScore: number, matchData: string) => ({
    discoveryStatus,
    matchScore,
    matchData,
    automation: { matchThreshold: 60 },
  });

  it("drops analyzed jobs the model scored under the threshold", () => {
    expect(isUserSwipe(row("dismissed", 40, '{"analyzed":true}'))).toBe(false);
    expect(isUserSwipe(row("dismissed", 40, "{}"))).toBe(false); // legacy: no flag, real score
  });

  it("keeps the user's own clicks", () => {
    expect(isUserSwipe(row("accepted", 40, '{"analyzed":true}'))).toBe(true);
    expect(isUserSwipe(row("dismissed", 70, '{"analyzed":true}'))).toBe(true);
    expect(isUserSwipe(row("dismissed", 40, '{"analyzed":false}'))).toBe(true);
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
  // Equal lexical scores, so the cap keeps input order: A, B, C.
  const jobs = ["A", "B", "C", "D", "E"].map((x) => job(`${x} Manager`));
  // Filler makes "manager" rare enough to clear the minimum score.
  const corpus = [...jobs, ...Array.from({ length: 20 }, (_, i) => job(`Cook ${i}`))];
  const saved = (r: ReturnType<typeof runAtsPipeline>) =>
    [...r.toAnalyze, ...r.toSaveUnanalyzed].map((s) => s.job.title).sort();

  it("reorders the LLM budget inside the cap without changing which jobs are saved", () => {
    const plain = runAtsPipeline(jobs, config, [], { k: 1, cap: 3, corpus });
    expect(plain.toAnalyze[0].score).toBeGreaterThanOrEqual(APP_CONSTANTS.ATS_MIN_PRERANK_SCORE);
    // Penalty only, like the real prior: demoting A and B lifts C to the top;
    // E sits past the cap either way.
    const prior = (title: string) => (/^[AB] /.test(title) ? -0.15 : 0);
    const nudged = runAtsPipeline(jobs, config, [], { k: 1, cap: 3, corpus, prior });
    expect(nudged.toAnalyze.map((s) => s.job.title)).toEqual(["C Manager"]);
    expect(saved(nudged)).toEqual(["A Manager", "B Manager", "C Manager"]); // E stays out
    expect(saved(nudged)).toEqual(saved(plain));
    expect(nudged.funnel).toEqual(plain.funnel);
    expect(nudged.toAnalyze[0].score).toBe(plain.toAnalyze[0].score); // stored score stays lexical
  });
});
