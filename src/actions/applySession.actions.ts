"use server";

import db from "@/lib/db";
import { handleError } from "@/lib/utils";
import { requireUser } from "./shared";

export const getApplyQueue = async (): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const sessions = await db.applySession.findMany({
      where: { userId: user.id },
      include: {
        Job: { include: { JobTitle: true, Company: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { success: true, data: sessions };
  } catch (error) {
    return handleError(error, "Failed to fetch apply queue.");
  }
};

export const getApplySessionDetail = async (id: string): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const session = await db.applySession.findFirst({
      where: { id, userId: user.id },
      include: {
        Job: { include: { JobTitle: true, Company: true } },
        Resume: { select: { id: true, title: true } },
      },
    });
    if (!session) return { success: false, message: "Apply session not found" };
    return { success: true, data: session };
  } catch (error) {
    return handleError(error, "Failed to fetch apply session.");
  }
};

// Whether the job already has a session in flight or awaiting review, so the
// queue page's "Fill application" entry point doesn't kick off a second one
// (the DB's partial unique index would reject it anyway; this just avoids
// the round trip and shows the existing session instead).
export const getActiveApplySessionForJob = async (jobId: string): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const session = await db.applySession.findFirst({
      where: { jobId, userId: user.id, status: { in: ["queued", "filling", "needs_review"] } },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: session };
  } catch (error) {
    return handleError(error, "Failed to check apply session.");
  }
};
