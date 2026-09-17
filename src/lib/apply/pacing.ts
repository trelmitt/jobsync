import { APP_CONSTANTS } from "@/lib/constants";

// Not anti-detection — human-paced by policy (see plan: no fingerprint
// spoofing, no fake mouse movement). This just stops a field-by-field fill
// from happening in a single instant burst.
export async function pacedDelay(): Promise<void> {
  const [min, max] = APP_CONSTANTS.APPLY_FIELD_DELAY_MS_RANGE;
  const ms = min + Math.random() * (max - min);
  await new Promise((resolve) => setTimeout(resolve, ms));
}
