import type {
  JobFacts,
  JobMatchRecommendation,
  JobMatchResult,
  JobMatchScores,
} from "@/models/ai.schemas";
import { stripThinking } from "@/lib/ai/stripThinking";

// Isomorphic parser shared by the client stream util and the server-side
// automation runner. No `server-only`, no `fetch` — pure text -> result.

// Match greedily on digits (not {1,3}) so an out-of-range value like 1000 still
// parses — clamp() below brings it back into 0-100 rather than failing the
// whole line and dropping the score.
const SCORES_RE =
  /SCORES:\s*match=(\d+)\s+recommendation=(strong|good|partial|weak)/i;

const RECOMMENDATION_LABELS: Record<string, JobMatchRecommendation> = {
  strong: "strong match",
  good: "good match",
  partial: "partial match",
  weak: "weak match",
};

export function parseJobMatch(raw: string): JobMatchResult {
  const text = stripThinking(raw);
  const match = text.match(SCORES_RE);

  let scores: JobMatchScores | undefined;
  if (match) {
    const matchScore = Math.max(0, Math.min(100, Number(match[1])));
    scores = {
      matchScore,
      recommendation: RECOMMENDATION_LABELS[match[2].toLowerCase()],
    };
  }

  // Remove the scores line from the body. Before it has fully streamed, also
  // hide a leading partial "SCORES:" line so it doesn't flash in the markdown.
  let body = match
    ? text.replace(match[0], "")
    : text.replace(/^\s*SCORES:[^\n]*(\n|$)/i, "");
  body = body.replace(/^\s+/, "");

  return { scores, body };
}

// Automation-match only: the second output line, one field per candidate
// priority (salary/OTE, bonus/incentives, equity, benefits, remote). The
// prompt contract fixes the label order, so a single anchored regex parses
// it the same way SCORES_RE does above.
const FACTS_RE =
  /FACTS:\s*Role:\s*([^;]*);\s*Salary\/OTE:\s*([^;]*);\s*Bonus\/Incentives:\s*([^;]*);\s*Equity:\s*([^;]*);\s*Benefits:\s*([^;]*);\s*Remote:\s*([^\n]*)/i;

export function parseJobFacts(text: string): { facts?: JobFacts; body: string } {
  const match = text.match(FACTS_RE);
  if (!match) return { body: text };

  const facts: JobFacts = {
    role: match[1].trim(),
    salary: match[2].trim(),
    bonusIncentives: match[3].trim(),
    equity: match[4].trim(),
    benefits: match[5].trim(),
    remote: match[6].trim(),
  };

  const body = text.replace(match[0], "").replace(/^\s+/, "");
  return { facts, body };
}
