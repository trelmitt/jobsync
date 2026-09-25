import { dueFollowUp } from "@/lib/followUp";

const applied = new Date("2026-09-01T12:00:00Z");
const day = (n: number) => new Date(applied.getTime() + n * 24 * 60 * 60 * 1000);

describe("dueFollowUp", () => {
  it("owes nothing before day 3", () => {
    expect(dueFollowUp(applied, null, day(2))).toBeNull();
  });

  it("returns the latest step that has come due", () => {
    expect(dueFollowUp(applied, null, day(3))).toBe(3);
    expect(dueFollowUp(applied, null, day(8))).toBe(7);
    expect(dueFollowUp(applied, null, day(30))).toBe(14);
  });

  it("is cleared by a touch after the step came due, until the next step", () => {
    expect(dueFollowUp(applied, day(4), day(5))).toBeNull();
    expect(dueFollowUp(applied, day(4), day(7))).toBe(7);
  });

  it("isn't cleared by a touch from before the step", () => {
    expect(dueFollowUp(applied, day(1), day(3))).toBe(3);
  });
});
