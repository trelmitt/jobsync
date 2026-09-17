import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/db";
import { submitApplySession } from "@/lib/apply/runner";
import { log } from "@/lib/telemetry";

// The ONLY route that ever calls submitApplySession, which is in turn the
// only code path that clicks a real Submit button. Every other step in the
// apply engine stops one page-state short of this.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ message: "Not Authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const applySession = await db.applySession.findFirst({ where: { id, userId } });
  if (!applySession) {
    return NextResponse.json({ message: "Apply session not found" }, { status: 404 });
  }

  try {
    await submitApplySession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Apply session submit error", { "apply.session_id": id, error: String(error) });
    const message = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
