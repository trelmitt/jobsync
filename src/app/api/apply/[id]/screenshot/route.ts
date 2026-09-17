import "server-only";

import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/db";
import { isApplyScreenshotPath } from "@/lib/apply/runner";

// Mirrors /api/profile/resume's GET: the path comes from the caller's own
// row, never the client, and is confirmed to live under the screenshots dir
// before being read.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Not Authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const applySession = await db.applySession.findFirst({
    where: { id, userId },
    select: { screenshotPaths: true },
  });

  const paths: string[] = applySession?.screenshotPaths
    ? JSON.parse(applySession.screenshotPaths)
    : [];
  const storedPath = paths[0];

  if (!storedPath || !isApplyScreenshotPath(storedPath) || !fs.existsSync(path.resolve(storedPath))) {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  const fileContent = fs.readFileSync(path.resolve(storedPath));
  return new NextResponse(fileContent, { headers: { "Content-Type": "image/png" } });
}
