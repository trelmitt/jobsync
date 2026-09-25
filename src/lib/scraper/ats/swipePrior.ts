import { tokenize } from "./rank";

// Learned from the user's own inbox: a job whose title reads like the ones
// they dismissed (rather than the ones they accepted) ranks down. Penalty
// only: swipes from one search would otherwise boost that search's roles in
// another (AE-era accepts lifting Enterprise AE over RevOps in a J2 run).
// Only reorders the jobs inside the save cap, so it decides which get the LLM
// call; it never drops one. Offline on 252 real swipes (51 accepts, 201
// dismisses): leave-one-out AUC 0.89; it pushes down 164 of the dismissed jobs
// and 3 of the accepted ones.
// ponytail: title-only naive-Bayes log-odds. Add description terms if title
// words stop separating accepts from dismisses.

const SHRINK = 2; // pseudo-swipes pulling each word toward the overall accept rate
// Rarer words are noise: three accepted CEE jobs made "Europe" look like a
// preference at a 5-swipe minimum.
const MIN_TOKEN_SWIPES = 10;
const MIN_EACH = 10; // fewer accepts or dismisses than this: no prior
const MAX_PENALTY = 0.15; // about one rare target-title hit in scoreJob units

// Analyzed jobs under the automation's threshold are saved as "dismissed" too;
// only the user's own accept/dismiss clicks count as swipes.
// ponytail: judged against today's threshold, so lowering it later re-labels
// old auto-rejects in the gap as swipes. Store a marker on auto-rejects if
// that starts to matter.
export function isUserSwipe(job: {
  discoveryStatus: string | null;
  matchScore: number | null;
  matchData: string | null;
  automation: { matchThreshold: number } | null;
}): boolean {
  if (job.discoveryStatus === "accepted") return true;
  let analyzed = true; // legacy rows carry no flag but a real AI score
  try {
    analyzed = JSON.parse(job.matchData ?? "{}").analyzed !== false;
  } catch {}
  return !(
    analyzed &&
    job.automation !== null &&
    (job.matchScore ?? 0) < job.automation.matchThreshold
  );
}

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
    return MAX_PENALTY * Math.tanh(Math.min(0, logOdds) / 2);
  };
}
