"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { requireUser } from "./shared";
import { notifyPartnerSuggestionReply } from "@/lib/partner/notify";
import type { ActionResult } from "@/models/action.model";
import type { Suggestion } from "@prisma/client";

export async function getSuggestions(): Promise<ActionResult<Suggestion[]>> {
  try {
    const user = await requireUser();
    const suggestions = await prisma.suggestion.findMany({
      where: { userId: user.id },
      // Open items first (new before reviewed/promoted/dismissed), newest within.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return { success: true, data: suggestions };
  } catch (error) {
    return handleError(error, "Failed to load suggestions.");
  }
}

// Triage a partner suggestion. "promote"/"dismiss"/"reviewed" set the status she
// sees; replyNote is the verdict shown back on her page. Promote does NOT create
// a junk Job — the owner adds it through the normal add-job flow (scraper-filled)
// via the link in the inbox.
// ponytail: promote = status + reply + link, not auto-Job-creation. Wire an
// auto-create through createJobRecord if manual add proves annoying.
export async function reviewSuggestion(
  id: string,
  action: "promote" | "dismiss" | "reviewed",
  replyNote?: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const status =
      action === "promote" ? "promoted" : action === "dismiss" ? "dismissed" : "reviewed";
    const suggestion = await prisma.suggestion.update({
      where: { id, userId: user.id },
      data: { status, replyNote: replyNote?.trim() || null },
    });
    revalidatePath("/dashboard/suggestions");
    revalidatePath("/partner");
    await notifyPartnerSuggestionReply(status, suggestion.replyNote, suggestion.url);
    return { success: true };
  } catch (error) {
    return handleError(error, "Failed to update suggestion.");
  }
}

export async function getOpenSuggestionCount(): Promise<ActionResult<number>> {
  try {
    const user = await requireUser();
    const count = await prisma.suggestion.count({ where: { userId: user.id, status: "new" } });
    return { success: true, data: count };
  } catch (error) {
    return handleError(error, "Failed to count suggestions.");
  }
}
