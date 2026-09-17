import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/db";

// Lightweight poll target for the review page while a fill is in progress —
// cheaper than wiring an SSE consumer just to watch one status field.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ message: "Not Authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const applySession = await db.applySession.findFirst({
    where: { id, userId },
    select: { status: true },
  });
  if (!applySession) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ status: applySession.status });
}
