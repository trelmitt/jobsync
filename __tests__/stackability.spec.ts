import { STACKABLE_SCORE, stackability } from "@/lib/stackability";

describe("stackability", () => {
  it("rates a fractional, async, internal GTM role as stackable", () => {
    const s = stackability({
      title: "Fractional RevOps Lead",
      description: "<p>We're async-first and results-oriented, with flexible hours.</p>",
    });
    expect(s.score).toBeGreaterThanOrEqual(STACKABLE_SCORE);
    expect(s.green).toEqual(
      expect.arrayContaining(["Fractional / part-time / contract", "Internal-facing GTM", "Async-first"]),
    );
    expect(s.red).toEqual([]);
  });

  it("rates a travelling, office-bound quota role low", () => {
    const s = stackability({
      title: "Enterprise Account Executive",
      description: "Daily standups. This is a hybrid role, 3 days a week in our NYC office. Travel up to 50%.",
    });
    expect(s.score).toBeLessThan(STACKABLE_SCORE);
    expect(s.red).toEqual(
      expect.arrayContaining(["Quota / customer-facing", "Daily standups", "In-office days", "Heavy travel"]),
    );
  });

  it("ignores sales boilerplate that only looks like a signal", () => {
    const s = stackability({
      title: "HR Business Partner",
      description: "Be a trusted advisor, negotiate contracts, use office productivity tools, enjoy on-site lunch.",
    });
    expect(s.green).toEqual([]);
    expect(s.red).toEqual([]);
    expect(s.score).toBe(50);
  });

  it("counts a part-time or contract job type even when the title doesn't say so", () => {
    expect(stackability({ title: "Sales Enablement Manager", description: "", jobType: "C" }).green).toContain(
      "Fractional / part-time / contract",
    );
  });

  it("flags exclusivity wording whatever the score", () => {
    const s = stackability({
      title: "Fractional Head of Sales",
      description: "Async-first. Employees may not engage in any outside employment while here.",
    });
    expect(s.exclusivity).toBe(true);
  });
});
