const { db, tailorResumeForJob, generateText, saveCoverLetterForJob } = vi.hoisted(() => ({
  db: {
    applySession: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  },
  tailorResumeForJob: vi.fn(),
  generateText: vi.fn(),
  saveCoverLetterForJob: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/tailor/tailorResume", () => ({ tailorResumeForJob }));
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/coverLetter/save", () => ({ saveCoverLetterForJob }));
vi.mock("@/lib/ai", () => ({ getModel: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/scraper/automation-run/aiSettings", () => ({
  getUserAiSettings: vi.fn().mockResolvedValue({ provider: "macengine", model: "m" }),
}));
vi.mock("@/lib/agent/jobLookup", () => ({
  resolveJobForAgent: vi.fn().mockResolvedValue({ status: "ok", job: { matchData: null } }),
}));
vi.mock("@/lib/agent/resumeLookup", () => ({
  resolveResumeForAgent: vi.fn().mockResolvedValue({ status: "ok", resume: {} }),
}));
vi.mock("@/lib/ai/tools/preprocessing", () => ({
  preprocessResume: vi.fn().mockResolvedValue({ success: true, data: { normalizedText: "resume" } }),
}));
vi.mock("@/lib/ai/tools/preprocessing-job", () => ({
  preprocessJob: vi.fn().mockResolvedValue({ success: true, data: { normalizedText: "job" } }),
}));

import { prepareApplication } from "@/lib/apply/prepare";

describe("prepareApplication", () => {
  const log = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    db.applySession.findUniqueOrThrow.mockResolvedValue({
      jobId: "job1",
      userId: "user1",
      resumeId: "base",
    });
    generateText.mockResolvedValue({ text: "<think>x</think>Dear team, ..." });
  });

  it("points the session at the tailored resume and writes the letter from the base resume", async () => {
    tailorResumeForJob.mockResolvedValue({ resumeId: "tailored", groupsReordered: 2, rejected: [] });

    await prepareApplication("s1", log);

    expect(db.applySession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { resumeId: "tailored" },
    });
    expect(saveCoverLetterForJob).toHaveBeenCalledWith("user1", "job1", "Dear team, ...");
  });

  it("keeps the base resume and still writes the letter when tailoring fails", async () => {
    tailorResumeForJob.mockRejectedValue(new Error("Tailoring needs a .docx resume file"));

    await prepareApplication("s1", log);

    expect(db.applySession.update).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Tailoring skipped, using the base resume", {
      error: "Error: Tailoring needs a .docx resume file",
    });
    expect(saveCoverLetterForJob).toHaveBeenCalled();
  });

  it("never throws when the letter fails, so the fill still runs", async () => {
    tailorResumeForJob.mockResolvedValue({ resumeId: "tailored", groupsReordered: 0, rejected: [] });
    generateText.mockRejectedValue(new Error("Bad Gateway"));

    await expect(prepareApplication("s1", log)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("Cover letter skipped", { error: "Error: Bad Gateway" });
  });
});
