import { getDiscoveredJobs } from "@/actions/automation.actions";
import { DiscoveredInbox } from "@/components/discovered/DiscoveredInbox";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ?top=10 is the daily queue: the best-scored few instead of the whole backlog.
export default async function DiscoveredPage({
  searchParams,
}: {
  searchParams: Promise<{ top?: string }>;
}) {
  const top = Number((await searchParams).top) || 0;
  const res = await getDiscoveredJobs({
    discoveryStatus: "new",
    sortBy: "matchScore",
    sortOrder: "desc",
    // ponytail: single page, no infinite scroll — add load-more if the
    // unreviewed queue regularly exceeds this.
    limit: top > 0 ? Math.min(top, 200) : 200,
  });
  const jobs = (res.success ? res.data : []) ?? [];

  return (
    <div className="col-span-3 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Discovered</h1>
        <p className="text-sm text-muted-foreground">
          Jobs your automations found, across all of them. Go one at a time —
          dismiss, hold, or apply.
        </p>
        {top > 0 && (
          <p className="text-sm text-muted-foreground">
            Top {jobs.length} by match score, {res.total ?? jobs.length} waiting in all.{" "}
            <Link href="/dashboard/discovered" className="underline">
              Show all
            </Link>
          </p>
        )}
      </div>
      <DiscoveredInbox initialJobs={jobs} />
    </div>
  );
}
