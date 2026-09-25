// Nudges after applying: day 3 check in, day 7 follow up, day 14 last nudge.
export const FOLLOW_UP_DAYS = [3, 7, 14] as const;

const DAY = 24 * 60 * 60 * 1000;

// The latest step that has come due and hasn't been answered by a touch
// (a note) since it came due; null when nothing is owed.
export function dueFollowUp(appliedDate: Date, lastTouch: Date | null, now: Date): number | null {
  const step = FOLLOW_UP_DAYS.filter((d) => appliedDate.getTime() + d * DAY <= now.getTime()).at(-1);
  if (step === undefined) return null;
  return lastTouch && lastTouch.getTime() >= appliedDate.getTime() + step * DAY ? null : step;
}
