"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { PARTNER_COOKIE, createPartnerToken } from "@/lib/partner/session";
import {
  verifyPin,
  clientKey,
  loginAllowed,
  recordFailedLogin,
  clearLoginAttempts,
  requirePartner,
} from "@/lib/partner/auth";
import { getOwnerId } from "@/lib/partner/queries";
import { notifyOwnerNewSuggestion } from "@/lib/partner/notify";
import type { ActionResult } from "@/models/action.model";

export async function partnerLogin(pin: string): Promise<ActionResult> {
  try {
    const key = await clientKey();
    const gate = loginAllowed(key);
    if (!gate.allowed) {
      return {
        success: false,
        message: `Too many attempts. Try again in ${Math.ceil(gate.retryInMs / 60000)} min.`,
      };
    }
    const ok = await verifyPin((pin || "").trim());
    if (!ok) {
      recordFailedLogin(key);
      return { success: false, message: "Incorrect PIN." };
    }
    clearLoginAttempts(key);
    const { token, maxAge } = await createPartnerToken();
    const jar = await cookies();
    jar.set(PARTNER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/partner",
      maxAge,
    });
    return { success: true };
  } catch (error) {
    return handleError(error, "Login failed.");
  }
}

export async function partnerLogout(): Promise<ActionResult> {
  const jar = await cookies();
  jar.set(PARTNER_COOKIE, "", { path: "/partner", maxAge: 0 });
  return { success: true };
}

const suggestionSchema = z.object({
  url: z.string().trim().url().max(2000),
  whyMe: z.string().trim().max(500).optional(),
});

export async function submitSuggestion(input: {
  url: string;
  whyMe?: string;
}): Promise<ActionResult> {
  try {
    await requirePartner();
    const parsed = suggestionSchema.safeParse({
      url: input.url,
      whyMe: input.whyMe?.trim() || undefined,
    });
    if (!parsed.success) return { success: false, message: "Please paste a valid job link." };
    const { url, whyMe } = parsed.data;
    if (!/^https?:\/\//i.test(url)) {
      return { success: false, message: "Link must start with http:// or https://" };
    }
    const uid = await getOwnerId();
    if (!uid) return { success: false, message: "No account set up yet." };
    // Light anti-abuse: bound the pending queue a PIN-holder can create.
    const open = await prisma.suggestion.count({ where: { userId: uid, status: "new" } });
    if (open >= 50) return { success: false, message: "Too many pending suggestions." };
    await prisma.suggestion.create({ data: { userId: uid, url, whyMe: whyMe || null } });
    revalidatePath("/partner");
    revalidatePath("/dashboard/suggestions");
    await notifyOwnerNewSuggestion(url, whyMe);
    return { success: true };
  } catch (error) {
    return handleError(error, "Could not submit suggestion.");
  }
}
