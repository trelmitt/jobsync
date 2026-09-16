import { APP_CONSTANTS } from "@/lib/constants";
import type { CreateAutomationInput } from "@/models/automation.schema";
import type { AtsConfigValue } from "../AtsSearchStep";

export type AtsKey = "greenhouse" | "lever";

export const EMPTY_ATS: AtsConfigValue = {
  companies: [],
  targetTitles: [],
  keywords: [],
  locations: [],
  strictLocation: false,
  // Analyze every relevant listing by default — local AI matching is fast and
  // free, so there's no cost reason to leave most listings unanalyzed.
  topK: APP_CONSTANTS.ATS_LISTING_CAP,
  saveUnanalyzed: true,
};

export const STEPS = [
  { id: "basics", title: "Basics", description: "Name your automation" },
  { id: "search", title: "Search", description: "Configure search criteria" },
  { id: "resume", title: "Resume", description: "Select resume for matching" },
  { id: "matching", title: "Matching", description: "Set match threshold" },
  { id: "schedule", title: "Schedule", description: "When to run" },
  { id: "review", title: "Review", description: "Confirm settings" },
];

export const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

export function parseEditSourceConfig(
  sc?: string | null,
): CreateAutomationInput["sourceConfig"] | undefined {
  if (!sc) return undefined;
  try {
    const parsed = JSON.parse(sc);
    return parsed?.greenhouse || parsed?.lever ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export interface WizardResume {
  id: string;
  title: string;
}
