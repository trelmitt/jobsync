import { getDiscoveredJobs } from "@/actions/automation.actions";
import { DiscoveredInbox } from "@/components/discovered/DiscoveredInbox";
import { STACKABLE_SCORE, stackability } from "@/lib/stackability";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ?top=10 is the daily queue: the best-scored few instead of the whole backlog.
// ?view=stack is the stack review: only jobs that could sit beside another one.
export default async function DiscoveredPage({
  searchParams,
}: {
  searchParams: Promise<{ top?: string; view?: string }>;
}) {
  const params = await searchParams;
  const top = Number(params.top) || 0;
  const stack = params.view === "stack";
  const res = await getDiscoveredJobs({
    discoveryStatus: "new",
    sortBy: "matchScore",
    sortOrder: "desc",
    // ponytail: single page, no infinite scroll — add load-more if the
    // unreviewed queue regularly exceeds this. Stack review scores in JS, so
    // it reads a bigger slice to rank from.
    limit: stack ? 1000 : top > 0 ? Math.min(top, 200) : 200,
  });
  const all = (res.success ? res.data : []) ?? [];
  const jobs = stack
    ? all
        .map((job) => ({ job, s: stackability({ ...job, title: job.JobTitle.label }).score }))
        .filter(({ s }) => s >= STACKABLE_SCORE)
        .sort((a, b) => b.s - a.s)
        .map(({ job }) => job)
    : all;

  return (
    <div className="col-span-3 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Discovered</h1>
        <p className="text-sm text-muted-foreground">
          Jobs your automations found, across all of them. Go one at a time —
          dismiss, hold, or apply.
        </p>
        {top > 0 && !stack && (
          <p className="text-sm text-muted-foreground">
            Top {jobs.length} by match score, {res.total ?? jobs.length} waiting in all.{" "}
            <Link href="/dashboard/discovered" className="underline">
              Show all
            </Link>
          </p>
        )}
        {stack && (
          <p className="text-sm text-muted-foreground">
            Stack review: jobs scoring {STACKABLE_SCORE}+ on async, low-meeting signals, best first.
            Read the offer&apos;s outside-work and conflict clauses before saying yes.{" "}
            <Link href="/dashboard/discovered" className="underline">
              Show all
            </Link>
          </p>
        )}
        {!stack && (
          <Link href="/dashboard/discovered?view=stack" className="text-sm underline">
            Stack review
          </Link>
        )}
      </div>
      <DiscoveredInbox initialJobs={jobs} />
    </div>
  );
}
