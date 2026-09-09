/**
 * Opportunity Fit User Prompt
 * Builds the user prompt for the opportunity-fit pass (job vs. candidate's
 * stated opportunity preferences).
 */

export function buildOpportunityFitPrompt(
  jobDescription: string,
  opportunityProfile: string,
): string {
  return `CANDIDATE'S OPPORTUNITY PREFERENCES:
${opportunityProfile}

JOB LISTING:
${jobDescription}

Output the scores line first, then a 1-2 sentence Summary naming the specific signals that drove the score.`;
}
