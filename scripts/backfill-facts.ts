// One-off backfill: re-runs the automation-match LLM call (which now emits
// the FACTS line) against every already-saved, automation-sourced job so
// existing Discovered jobs get salary/equity/benefits/remote facts too, not
// just newly-discovered ones. Reuses matchJobToResume as-is (no re-scrape —
// JobDetails is rebuilt from the Job row's own stored columns).
//
// Run: DATABASE_URL="file:/absolute/path/to/dev.db" npx tsx scripts/backfill-facts.ts
import db from "@/lib/db";
import {
  matchJobToResume,
  getUserAiSettings,
  getUserJobPreferences,
} from "@/lib/scraper/runner";
import type { JobDetails } from "@/lib/scraper/types";
import type { JobBoard } from "@/models/automation.model";

const RESUME_INCLUDE = {
  ContactInfo: true,
  ResumeSections: {
    include: {
      summary: true,
      workExperiences: { include: { Company: true, jobTitle: true, location: true } },
      educations: { include: { location: true } },
      licenseOrCertifications: true,
      skills: { include: { Tag: true } },
    },
  },
} as const;

async function main() {
  const allJobs = await db.job.findMany({
    where: { automationId: { not: null } },
    include: { JobTitle: true, Company: true, Location: true, automation: true },
    orderBy: { discoveredAt: "asc" },
  });

  // BACKFILL_LIMIT lets us smoke-test on a couple of jobs before the full run.
  const limit = process.env.BACKFILL_LIMIT ? parseInt(process.env.BACKFILL_LIMIT, 10) : undefined;
  const jobs = limit ? allJobs.slice(0, limit) : allJobs;

  console.log(`Found ${allJobs.length} automation-sourced jobs${limit ? `, processing first ${jobs.length}` : ""}.`);

  const automationCache = new Map<
    string,
    { resume: any; aiSettings: any; jobPreferences: any } | null
  >();

  let succeeded = 0;
  let failed = 0;
  let statusFlipped = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const automation = job.automation;
    if (!automation) {
      console.log(`[${i + 1}/${jobs.length}] skip (no automation): ${job.id}`);
      continue;
    }

    let cached = automationCache.get(automation.id);
    if (cached === undefined) {
      const resume = await db.resume.findUnique({
        where: { id: automation.resumeId },
        include: RESUME_INCLUDE,
      });
      if (!resume) {
        console.log(`[skip-automation] ${automation.id} resume missing`);
        cached = null;
      } else {
        cached = {
          resume,
          aiSettings: await getUserAiSettings(automation.userId),
          jobPreferences: await getUserJobPreferences(automation.userId),
        };
      }
      automationCache.set(automation.id, cached);
    }
    if (!cached) continue;
    const { resume, aiSettings, jobPreferences } = cached;

    const jobDetails: JobDetails = {
      title: job.JobTitle.label,
      company: job.Company.label,
      location: job.Location?.label ?? "",
      description: job.description,
      url: job.jobUrl ?? "",
      salary: job.salaryRange ?? undefined,
      employmentType: job.jobType ?? undefined,
      workplaceType: job.workplaceType ?? undefined,
    };

    console.log(`[${i + 1}/${jobs.length}] ${jobDetails.title} @ ${jobDetails.company}`);

    const result = await matchJobToResume(
      jobDetails,
      resume,
      automation.jobBoard as JobBoard,
      aiSettings,
      automation.userId,
      undefined,
      jobPreferences,
    );

    if (!result.success) {
      failed++;
      console.log(`  FAILED: ${result.error}`);
      if (result.error === "ai_unavailable") {
        console.log("Ollama unavailable — stopping run.");
        break;
      }
      continue;
    }

    let previous: Record<string, unknown> = {};
    try {
      previous = JSON.parse(job.matchData ?? "{}");
    } catch {
      previous = {};
    }

    const matchData = {
      ...result.data,
      resumeId: resume.id,
      resumeTitle: resume.title,
      matchedAt: new Date().toISOString(),
      provider: aiSettings.provider,
      model: aiSettings.model,
      prerankScore: previous.prerankScore,
      prerankComponents: previous.prerankComponents,
      analyzed: true,
    };

    // "accepted" is a user decision, not a pipeline output — never flip it.
    let discoveryStatus = job.discoveryStatus;
    if (job.discoveryStatus !== "accepted") {
      const newStatus = result.score >= automation.matchThreshold ? "new" : "dismissed";
      if (newStatus !== job.discoveryStatus) statusFlipped++;
      discoveryStatus = newStatus;
    }

    await db.job.update({
      where: { id: job.id },
      data: { matchScore: result.score, matchData: JSON.stringify(matchData), discoveryStatus },
    });

    succeeded++;
    console.log(`  -> ${result.score}% (${discoveryStatus})`);
  }

  console.log(
    `Done. total=${jobs.length} succeeded=${succeeded} failed=${failed} statusFlipped=${statusFlipped}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
