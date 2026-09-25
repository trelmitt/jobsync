// How well a job would sit alongside another one, read from the posting's own
// words. The consensus from people who hold two jobs: the second one has to be
// async, judged on deliverables, and light on meetings. Customer-facing,
// quota-carrying work is the hardest to stack.
//
// ponytail: phrase matching, not a model pass. It misses load a posting only
// implies ("you'll run QBRs"); add a per-signal model check if these flags
// prove too shallow.

interface Signal {
  label: string;
  re: RegExp;
  weight: number;
}

// Matched against the title only: "contract" and "advisor" are everywhere in
// sales descriptions ("negotiate contracts", "trusted advisor").
const ENGAGEMENT: Signal = {
  label: "Fractional / part-time / contract",
  re: /\b(fractional|part[- ]time|contract(or)?|advisor|advisory|1099)\b/i,
  weight: 25,
};

const ROLE_FAMILIES: Signal[] = [
  {
    label: "Internal-facing GTM",
    re: /\b(rev ?ops|revenue operations|sales operations|sales ops|gtm (ops|operations|engineer(ing)?|systems)|sales systems|crm|enablement|deal desk)\b/i,
    weight: 15,
  },
  {
    label: "Partner / ecosystem",
    re: /\b(partner (manager|development|marketing|success|sales)|partnerships?|alliances?|ecosystem|channel)\b/i,
    weight: 5,
  },
  {
    label: "Quota / customer-facing",
    re: /\b(account executive|ae|sdr|bdr|sales development|customer success|csm|sales manager|head of sales|director of sales|vp,? sales)\b/i,
    weight: -15,
  },
];

const DESCRIPTION_SIGNALS: Signal[] = [
  { label: "Async-first", re: /\basync(hronous)?[- ]first\b|\basynchronous (work|communication|culture)\b/i, weight: 10 },
  { label: "Remote-first", re: /\bremote[- ]first\b/i, weight: 5 },
  { label: "Flexible hours", re: /\bflexible (hours|schedule|working hours)\b/i, weight: 5 },
  { label: "Results-oriented", re: /\b(results|outcomes?)[- ](oriented|driven|based)\b/i, weight: 5 },
  { label: "High autonomy", re: /\b(high|full) autonomy\b|\bself[- ]directed\b/i, weight: 5 },
  { label: "Writing culture", re: /\b(writing|written|documentation)[- ](culture|first)\b/i, weight: 5 },
  { label: "Daily standups", re: /\bdaily stand[- ]?ups?\b/i, weight: -10 },
  { label: "On-call", re: /\bon[- ]call\b/i, weight: -15 },
  { label: "Camera on", re: /\bcameras?[- ]on\b/i, weight: -15 },
  { label: "Core hours", re: /\bcore (working |business )?hours\b/i, weight: -5 },
  { label: "Real-time collaboration", re: /\breal[- ]time collaboration\b/i, weight: -5 },
  {
    label: "Activity quotas",
    re: /\b\d+\+?\s*(dials|calls|meetings) (a|per) (day|week)\b|\bactivity (metrics|targets|quotas?)\b/i,
    weight: -15,
  },
  { label: "Heavy travel", re: /\b[3-9]\d\s*%\s*(of the time\s*)?travel|\btravel\b[^.]{0,20}\b[3-9]\d\s*%/i, weight: -15 },
  // Office context only: "on-site lunch", "hybrid methodologies" and "office
  // productivity tools" aren't attendance requirements.
  {
    label: "In-office days",
    re: /#li-hybrid|\bhybrid (role|position|work|model|schedule|policy|team)\b|\bin[- ]office (days|policy|expectations|work)|\b\d days?(\/| per | a )week in\b|\bwork(ing)? (on[- ]?site|in (the|our) office)\b|\b(located|based) on[- ]?site\b|\bon[- ]?site (in|at) (our|the)\b/i,
    weight: -10,
  },
  { label: "Manages a team", re: /\b(manage|lead|build) (a |the )?team of\b|\bdirect reports\b/i, weight: -10 },
  { label: "Fast-paced / always-on", re: /\bfast[- ]paced\b|\balways[- ]on\b|\bhustle\b/i, weight: -5 },
];

// Breach risk rather than load, so it's flagged regardless of the score.
const EXCLUSIVITY =
  /\b(no|any) outside (employment|work|business)\b|\bexclusive(ly)? (employment|basis)\b|\bmoonlighting\b|\bsole (employer|employment)\b/i;

export interface Stackability {
  score: number;
  green: string[];
  red: string[];
  exclusivity: boolean;
}

export const STACKABLE_SCORE = 60;

export function stackability(job: { title: string; description: string; jobType?: string | null }): Stackability {
  const text = job.description.replace(/<[^>]+>/g, " ");
  const hits = [
    ...(ENGAGEMENT.re.test(job.title) || job.jobType === "PT" || job.jobType === "C" ? [ENGAGEMENT] : []),
    ...ROLE_FAMILIES.filter((s) => s.re.test(job.title)),
    ...DESCRIPTION_SIGNALS.filter((s) => s.re.test(text)),
  ];
  const score = Math.min(100, Math.max(0, 50 + hits.reduce((n, s) => n + s.weight, 0)));
  return {
    score,
    green: hits.filter((s) => s.weight > 0).map((s) => s.label),
    red: hits.filter((s) => s.weight < 0).map((s) => s.label),
    exclusivity: EXCLUSIVITY.test(text),
  };
}
