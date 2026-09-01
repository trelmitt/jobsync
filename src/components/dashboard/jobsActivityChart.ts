import { TopActivityType } from "@/actions/dashboard.actions";

// Donut hues, validated for colorblind separation against each theme's
// card surface. The app's own --chart-* tokens fail that check here:
// light --chart-3 (#274754) reads as near-black grey in a donut.
export const SERIES_COLORS = {
  light: ["#2a9d90", "#c97e22", "#6d4fc7"],
  dark: ["#16a89a", "#c08438", "#8b72e8"],
} as const;

export const OTHER_COLOR = { light: "#94a3b8", dark: "#64748b" } as const;

// Matches the "Other" bucket key charts/dashboard.actions builds server-side.
export const OTHER_ACTIVITY_LABEL = "Other";

export const OTHER_SLICE_ID = "__other__";

// A real activity type can itself be named "Other". When it is, the
// synthetic bucket needs a distinct display label so the two don't render
// as two identically-labeled slices/bars.
export function otherBucketLabel(topLabels: string[]): string {
  return topLabels.includes(OTHER_ACTIVITY_LABEL)
    ? "Other activity types"
    : OTHER_ACTIVITY_LABEL;
}

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  breakdown?: TopActivityType[];
}

// Hues are assigned by rank and never cycled, so a slice keeps its color
// for as long as the activity keeps its position.
export function buildDonutSlices(
  topActivities: TopActivityType[],
  otherHours: number,
  theme: "light" | "dark",
  otherActivities: TopActivityType[] = [],
): DonutSlice[] {
  const slices: DonutSlice[] = topActivities
    .filter((activity) => activity.hours > 0)
    .map((activity, index) => ({
      id: activity.label,
      label: activity.label,
      value: activity.hours,
      color: SERIES_COLORS[theme][index],
    }));

  if (otherHours > 0) {
    slices.push({
      id: OTHER_SLICE_ID,
      label: otherBucketLabel(topActivities.map((activity) => activity.label)),
      value: otherHours,
      color: OTHER_COLOR[theme],
      breakdown: otherActivities.filter((activity) => activity.hours > 0),
    });
  }

  return slices;
}

// Arc link label text, kept neutral rather than tinted from the slice so
// the grey "Other" hue never has to double as readable body text.
export const ARC_LABEL_TEXT_COLOR = {
  light: "#334155",
  dark: "#e2e8f0",
} as const;

const ARC_LABEL_MAX_CHARS = 16;

// The label renders as two lines, so the name is trimmed rather than left
// to run off the card edge.
export function arcLabelLines(slice: DonutSlice): [string, string] {
  const name =
    slice.label.length > ARC_LABEL_MAX_CHARS
      ? `${slice.label.slice(0, ARC_LABEL_MAX_CHARS - 1).trimEnd()}…`
      : slice.label;

  return [name, `${slice.value}h`];
}
