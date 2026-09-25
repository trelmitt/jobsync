import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { APP_CONSTANTS } from "@/lib/constants";
import {
  startApplySession,
  ApplySessionAlreadyRunningError,
} from "@/lib/apply/runner";
import { reapExpiredLiveSessions, reapStaleApplySessions } from "@/lib/apply/session";
import { log } from "@/lib/telemetry";
import { baseResumeIdFor } from "@/lib/tailor/tailorResume";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!APP_CONSTANTS.APPLY_ENGINE_ENABLED) {
    return NextResponse.json({ message: "Apply engine is disabled" }, { status: 403 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ message: "Not Authenticated" }, { status: 401 });
  }

  // This route's dynamic segment is the jobId — named `id` only so it matches
  // its sibling routes under /api/apply/[id]/* (Next.js requires every route
  // at the same path level to use the same param name).
  const { id: jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const prepare = body.prepare === true;
  // Tracked jobs added by hand or by Claude have no resume of their own.
  const resumeId: string | null = body.resumeId ?? (await baseResumeIdFor(jobId, userId));
  if (!resumeId) {
    return NextResponse.json({ message: "resumeId is required" }, { status: 400 });
  }

  await reapExpiredLiveSessions();
  await reapStaleApplySessions();

  try {
    const { id } = await startApplySession(jobId, userId, resumeId, { prepare });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    if (error instanceof ApplySessionAlreadyRunningError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 409 });
    }
    log.error("Apply session start error", { error: String(error) });
    const message = error instanceof Error ? error.message : "Failed to start apply session";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
