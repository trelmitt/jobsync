const { db } = vi.hoisted(() => ({
  db: {
    job: { findFirst: vi.fn(), update: vi.fn() },
    jobStatus: { findFirst: vi.fn() },
    resume: { findFirst: vi.fn() },
    userSettings: { findUnique: vi.fn() },
    question: { findMany: vi.fn() },
    applySession: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/apply/session", () => ({
  openLiveSession: vi.fn(),
  getLivePage: vi.fn(),
  closeLiveSession: vi.fn(),
}));
vi.mock("@/lib/apply/prepare", () => ({ prepareApplication: vi.fn() }));
vi.mock("@/lib/automation-logger", () => ({
  automationLogger: { startRun: vi.fn(), log: vi.fn(), endRun: vi.fn() },
}));

import { buildAnswerSheet } from "@/lib/apply/assist";
import { startApplySession, submitApplySession } from "@/lib/apply/runner";
import { getLivePage } from "@/lib/apply/session";

describe("apply assist mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.resume.findFirst.mockResolvedValue({
      ContactInfo: { firstName: "Trevor", lastName: "Elmitt", email: "t@x.io", phone: "", url1: "https://in/t", url1Label: "LinkedIn", url2: null },
    });
    db.userSettings.findUnique.mockResolvedValue({
      settings: JSON.stringify({ applyProfile: { workAuthorized: true, requiresSponsorship: false, desiredSalary: "" } }),
    });
    db.question.findMany.mockResolvedValue([
      { question: "Why us?", answer: "Inference GTM", createdVia: null },
      { question: "Years selling?", answer: "6", createdVia: "apply-engine" },
    ]);
    db.applySession.create.mockResolvedValue({ id: "s1" });
    db.applySession.findUniqueOrThrow.mockResolvedValue({
      id: "s1", userId: "user1", jobId: "job1", resumeId: "r1", platform: "assist", status: "needs_review",
    });
  });

  it("builds a copy-paste sheet from contact info, apply profile, and saved answers, skipping blanks", async () => {
    expect(await buildAnswerSheet("user1", "r1")).toEqual([
      { label: "First name", value: "Trevor", source: "resume" },
      { label: "Last name", value: "Elmitt", source: "resume" },
      { label: "Email", value: "t@x.io", source: "resume" },
      { label: "LinkedIn", value: "https://in/t", source: "resume" },
      { label: "Authorized to work", value: "Yes", source: "profile" },
      { label: "Requires sponsorship", value: "No", source: "profile" },
      { label: "Why us?", value: "Inference GTM", source: "question_bank" },
      { label: "Years selling?", value: "6", source: "ai_draft" },
    ]);
    expect(db.resume.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1", profile: { userId: "user1" } } }),
    );
  });

  it("falls back to assist only for the prep pipeline on unsupported sites", async () => {
    db.job.findFirst.mockResolvedValue({ jobUrl: "https://acme.wd1.myworkdayjobs.com/jobs/1" });

    await expect(startApplySession("job1", "user1", "r1")).rejects.toThrow("No apply adapter");
    await startApplySession("job1", "user1", "r1", { prepare: true });

    expect(db.applySession.create).toHaveBeenCalledTimes(1);
    expect(db.applySession.create.mock.calls[0][0].data.platform).toBe("assist");
    await vi.waitFor(() =>
      expect(db.applySession.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: expect.objectContaining({ status: "needs_review", fieldsFilled: expect.stringContaining("Trevor") }),
      }),
    );
  });

  it("records a manual submit without needing a live page", async () => {
    db.jobStatus.findFirst.mockResolvedValue({ id: "st-applied" });
    await submitApplySession("s1");

    expect(getLivePage).not.toHaveBeenCalled();
    expect(db.applySession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: expect.objectContaining({ status: "submitted" }),
    });
    expect(db.job.update).toHaveBeenCalledWith({
      where: { id: "job1" },
      data: expect.objectContaining({ applied: true, statusId: "st-applied" }),
    });
  });
});
