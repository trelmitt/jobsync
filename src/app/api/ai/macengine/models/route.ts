import { auth } from "@/auth";
import { getMacengineBaseUrl } from "@/actions/apiKey.actions";
import { NextResponse } from "next/server";
import { APP_CONSTANTS } from "@/lib/constants";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baseUrl = await getMacengineBaseUrl();
    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(APP_CONSTANTS.AI_MACENGINE_LIST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch macengine models" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn("macengine models unreachable:", error);
    return NextResponse.json(
      { error: "Cannot connect to macengine service" },
      { status: 502 },
    );
  }
}
