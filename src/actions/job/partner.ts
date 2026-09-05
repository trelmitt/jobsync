"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { requireUser } from "../shared";
import type { ActionResult } from "@/models/action.model";

// Per-job opt-in for the read-only partner dashboard. Off by default; only jobs
// the owner explicitly shares appear as cards on the partner page. Aggregate
// momentum counts are unaffected — they never reveal titles.
export async function toggleJobShared(
  jobId: string,
  shared: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await prisma.job.update({
      where: { id: jobId, userId: user.id },
      data: { sharedWithPartner: shared },
    });
    revalidatePath("/dashboard/myjobs");
    revalidatePath(`/dashboard/myjobs/${jobId}`);
    revalidatePath("/partner");
    return { success: true };
  } catch (error) {
    return handleError(error, "Failed to update sharing.");
  }
}
