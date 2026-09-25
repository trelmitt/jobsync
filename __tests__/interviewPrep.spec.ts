const { db, generateText } = vi.hoisted(() => ({
  db: { note: { create: vi.fn() } },
  generateText: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/ai", () => ({ getModel: vi.fn() }));
vi.mock("@/lib/agent/jobLookup", () => ({ resolveJobForAgent: vi.fn() }));
vi.mock("@/lib/agent/resumeLookup", () => ({ resolveResumeForAgent: vi.fn() }));
vi.mock("@/lib/ai/tools/preprocessing", () => ({
  preprocessResume: vi.fn().mockResolvedValue({ success: true, data: { normalizedText: "RESUME" } }),
}));
vi.mock("@/lib/ai/tools/preprocessing-job", () => ({
  preprocessJob: vi.fn().mockResolvedValue({ success: true, data: { normalizedText: "JOB" } }),
}));
vi.mock("@/lib/scraper/automation-run/aiSettings", () => ({
  getUserAiSettings: vi.fn().mockResolvedValue({ provider: "macengine", model: "m" }),
  getDefaultModelForProvider: vi.fn(),
}));
vi.mock("@/lib/ai/rate-limiter", () => ({ checkRateLimit: vi.fn().mockReturnValue({ allowed: true }) }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: "user-1" }) }));

import { generateInterviewPrep } from "@/actions/interviewPrep.actions";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";

const PREP = "## What they need\n- Pipeline\n\n## Likely questions\n1. Walk me through a deal.\n".repeat(4);

describe("generateInterviewPrep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (resolveJobForAgent as any).mockResolvedValue({ status: "ok", job: { id: "job-1", resumeId: "r1" } });
    (resolveResumeForAgent as any).mockResolvedValue({ status: "ok", resume: { id: "r1" } });
    db.note.create.mockResolvedValue({ id: "n1" });
  });

  it("saves the prep as a labelled note on the user's job, with model HTML escaped", async () => {
    generateText.mockResolvedValue({ text: `<think>plan</think>${PREP}<script>x</script>` });

    const res = await generateInterviewPrep("job-1");

    expect(res).toEqual({ success: true, data: { id: "n1" } });
    expect(resolveJobForAgent).toHaveBeenCalledWith("user-1", "job-1");
    const { data } = db.note.create.mock.calls[0][0];
    expect(data).toMatchObject({ jobId: "job-1", userId: "user-1" });
    expect(data.content).toContain("check every fact");
    expect(data.content).toContain("Walk me through a deal.");
    expect(data.content).not.toContain("<script>");
    expect(data.content).not.toContain("plan");
  });

  it("refuses another user's job", async () => {
    (resolveJobForAgent as any).mockResolvedValue({ status: "no_job" });
    const res = await generateInterviewPrep("job-x");
    expect(res.success).toBe(false);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("saves nothing when the model comes back nearly empty", async () => {
    generateText.mockResolvedValue({ text: "ok" });
    const res = await generateInterviewPrep("job-1");
    expect(res.success).toBe(false);
    expect(db.note.create).not.toHaveBeenCalled();
  });
});
