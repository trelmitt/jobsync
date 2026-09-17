import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/db";
import { cancelApplySession } from "@/lib/apply/runner";
import { log } from "@/lib/telemetry";

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
    await cancelApplySession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Apply session cancel error", { "apply.session_id": id, error: String(error) });
    return NextResponse.json({ success: false, message: "Failed to cancel" }, { status: 500 });
  }
}
