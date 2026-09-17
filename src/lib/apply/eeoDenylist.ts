// Hard safety rule, not configurable: any field whose label matches one of
// these patterns is always left blank, regardless of whether the question
// bank or AI drafting could answer it. See the plan's "Hard safety rule"
// section — this is the one thing the apply engine must never guess.
const EEO_LABEL_PATTERNS: RegExp[] = [
  /race/i,
  /ethnicity/i,
  /\bgender\b/i,
  /\bsex\b/i,
  /transgender/i,
  /veteran/i,
  /military status/i,
  /disab(led|ility)/i,
  /sexual orientation/i,
  /lgbtq/i,
  /pronouns?/i,
  /hispanic or latino/i,
];

export function isEeoField(label: string): boolean {
  return EEO_LABEL_PATTERNS.some((pattern) => pattern.test(label));
}
