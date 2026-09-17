import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/db";
import { automationLogger } from "@/lib/automation-logger";

function createSSEErrorResponse(message: string): NextResponse {
  const encoder = new TextEncoder();
  const errorData = JSON.stringify({ logs: [], isRunning: false, error: message });
  const body = encoder.encode(`data: ${errorData}\n\n`);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Mirrors /api/automations/[id]/logs — automationLogger is keyed by a plain
// string id, so the same singleton streams apply-session progress too.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return createSSEErrorResponse("Not Authenticated");
  }

  const { id: applySessionId } = await params;

  const applySession = await db.applySession.findFirst({
    where: { id: applySessionId, userId },
  });
  if (!applySession) {
    return createSSEErrorResponse("Apply session not found");
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(interval);
        clearTimeout(timeout);
        controller.close();
      };

      controller.enqueue(encoder.encode("retry: 86400000\n\n"));

      const store = automationLogger.getStore(applySessionId);
      if (store) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              logs: store.logs,
              isRunning: store.isRunning,
              startedAt: store.startedAt,
              completedAt: store.completedAt,
            })}\n\n`,
          ),
        );
      } else {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ logs: [], isRunning: false })}\n\n`),
        );
      }

      const interval = setInterval(() => {
        if (isClosed) return;
        const currentStore = automationLogger.getStore(applySessionId);
        if (currentStore) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                logs: currentStore.logs,
                isRunning: currentStore.isRunning,
                startedAt: currentStore.startedAt,
                completedAt: currentStore.completedAt,
              })}\n\n`,
            ),
          );
          if (!currentStore.isRunning && currentStore.completedAt) {
            clearInterval(interval);
          }
        }
      }, 1000);

      req.signal.addEventListener("abort", cleanup);
      const timeout = setTimeout(cleanup, 10 * 60 * 1000);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
