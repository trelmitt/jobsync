import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

import ApplyReviewClient from "@/app/dashboard/apply/[id]/ApplyReviewClient";

const session = (platform: string) => ({
  id: "s1",
  status: "failed",
  platform,
  jobId: "job1",
  resumeId: "r1",
  applicationUrl: "https://acme.wd1.myworkdayjobs.com/jobs/1",
  blockedReason: null,
  errorMessage: "boom",
  fieldsFilled: null,
  Job: { JobTitle: { label: "AE" }, Company: { label: "Acme" } },
  Resume: { id: "r1", title: "Base" },
});

describe("ApplyReviewClient refill", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, id: "s2" }) });
  });

  it.each([
    ["assist", true],
    ["greenhouse", false],
  ])("refills a failed %s session with prepare=%s", async (platform, prepare) => {
    render(<ApplyReviewClient session={session(platform)} />);

    await userEvent.click(screen.getByRole("button", { name: "Refill" }));

    expect(global.fetch).toHaveBeenCalledWith("/api/apply/job1/start", expect.objectContaining({
      body: JSON.stringify({ resumeId: "r1", prepare }),
    }));
    expect(push).toHaveBeenCalledWith("/dashboard/apply/s2");
  });
});
