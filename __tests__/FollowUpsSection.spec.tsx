import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowUpsSection } from "@/components/dashboard/FollowUpsSection";
import { addNote } from "@/actions/note.actions";

vi.mock("@/actions/note.actions", () => ({ addNote: vi.fn() }));
vi.mock("@/lib/toast", () => ({
  toastActionResult: (result: { success: boolean }, opts: { onSuccess?: () => void }) => {
    if (result.success) opts.onSuccess?.();
  },
}));

const job = (id: string, step: number) => ({ id, step, JobTitle: { label: `Role ${id}` } });

describe("FollowUpsSection", () => {
  it("shows jobs that arrive in later props", () => {
    const { rerender } = render(<FollowUpsSection jobs={[]} />);
    expect(screen.queryByText("Role a")).toBeNull();
    rerender(<FollowUpsSection jobs={[job("a", 3)]} />);
    expect(screen.getByText("Role a")).toBeInTheDocument();
  });

  it("Done hides only that step; the next step for the same job still shows", async () => {
    (addNote as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    const { rerender } = render(<FollowUpsSection jobs={[job("a", 3)]} />);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByText("Role a")).toBeNull());
    rerender(<FollowUpsSection jobs={[job("a", 7)]} />);
    expect(screen.getByText("Day 7: follow up")).toBeInTheDocument();
  });
});
