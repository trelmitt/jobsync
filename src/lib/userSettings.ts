import { log } from "@/lib/telemetry";
import type { UserSettingsData } from "@/models/userSettings.model";

// UserSettings.settings is free-form JSON text. One bad write must not take
// down every AI surface (scoring, tailoring, cover letters) or the Settings
// page that could fix it, so anything unparseable or non-object reads as {}
// and callers merge their defaults over it.
export function parseUserSettings(row: { userId: string; settings: string }): Partial<UserSettingsData> {
  try {
    const parsed: unknown = JSON.parse(row.settings);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Partial<UserSettingsData>;
    }
  } catch {
    // Falls through to the warning below.
  }
  log.warn("[UserSettings] Malformed settings JSON; using defaults", { userId: row.userId });
  return {};
}
