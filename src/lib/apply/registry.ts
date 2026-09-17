import type { JobBoard } from "@/models/automation.model";
import type { ApplyAdapter } from "./types";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";

const ADAPTERS: ApplyAdapter[] = [greenhouseAdapter, leverAdapter, ashbyAdapter];

export function detectPlatform(applicationUrl: string): JobBoard | null {
  const adapter = ADAPTERS.find((a) => a.matches(applicationUrl));
  return adapter?.platform ?? null;
}

export function getApplyAdapter(platform: JobBoard): ApplyAdapter | undefined {
  return ADAPTERS.find((a) => a.platform === platform);
}
