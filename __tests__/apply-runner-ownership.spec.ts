const { db } = vi.hoisted(() => ({
  db: {
    job: { findFirst: vi.fn() },
    resume: { findFirst: vi.fn() },
    applySession: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/apply/session", () => ({
  openLiveSession: vi.fn(),
  getLivePage: vi.fn(),
  closeLiveSession: vi.fn(),
}));
vi.mock("@/lib/automation-logger", () => ({
  automationLogger: { startRun: vi.fn(), log: vi.fn(), endRun: vi.fn() },
}));

import { startApplySession } from "@/lib/apply/runner";

describe("startApplySession resume ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.job.findFirst.mockResolvedValue({ jobUrl: "https://job-boards.greenhouse.io/acme/jobs/1" });
  });

  it("refuses a resume the user doesn't own, before creating a session", async () => {
    db.resume.findFirst.mockResolvedValue(null);

    await expect(startApplySession("job1", "user1", "someone-elses-resume")).rejects.toThrow("Resume not found");
    expect(db.resume.findFirst).toHaveBeenCalledWith({
      where: { id: "someone-elses-resume", profile: { userId: "user1" } },
      select: { id: true },
    });
    expect(db.applySession.create).not.toHaveBeenCalled();
  });
});
