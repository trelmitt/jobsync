import { tokenize } from "./rank";

// Learned from the user's own inbox: title words from jobs they accepted rank
// a job up, words from jobs they dismissed rank it down. Only reorders the
// relevance survivors, so it decides which jobs get the LLM call; it never
// drops one. Tuned offline on 936 real swipes: leave-one-out AUC 0.85.
// ponytail: title-only naive-Bayes log-odds. Add description terms if title
// words stop separating accepts from dismisses.

const SHRINK = 2; // pseudo-swipes pulling each word toward the overall accept rate
// Rarer words are noise: three accepted CEE jobs made "Europe" look like a
// preference at a 5-swipe minimum.
const MIN_TOKEN_SWIPES = 10;
const MIN_EACH = 10; // fewer accepts or dismisses than this: no prior
const MAX_BONUS = 0.15; // about one rare target-title hit in scoreJob units

export interface Swipe {
  title: string;
  accepted: boolean;
}

// Null when there isn't enough history to learn from. `exempt` is the
// automation's own target titles: explicit intent, so past swipes don't vote
// on those words.
export function buildSwipePrior(
  swipes: Swipe[],
  exempt: string[] = [],
): ((title: string) => number) | null {
  const accepted = swipes.filter((s) => s.accepted).length;
  const dismissed = swipes.length - accepted;
  if (accepted < MIN_EACH || dismissed < MIN_EACH) return null;

  const counts = new Map<string, { a: number; d: number }>();
  for (const s of swipes) {
    for (const t of new Set(tokenize(s.title))) {
      const c = counts.get(t) ?? { a: 0, d: 0 };
      if (s.accepted) c.a++;
      else c.d++;
      counts.set(t, c);
    }
  }

  const base = accepted / swipes.length;
  const logit = (p: number) => Math.log(p / (1 - p));
  const skip = new Set(exempt.flatMap(tokenize));
  const weights = new Map<string, number>();
  for (const [t, { a, d }] of counts) {
    if (a + d < MIN_TOKEN_SWIPES || skip.has(t)) continue;
    weights.set(t, logit((a + SHRINK * base) / (a + d + SHRINK)) - logit(base));
  }

  return (title) => {
    let logOdds = 0;
    for (const t of new Set(tokenize(title))) logOdds += weights.get(t) ?? 0;
    return MAX_BONUS * Math.tanh(logOdds / 2);
  };
}
