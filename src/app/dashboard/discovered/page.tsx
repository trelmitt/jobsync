import { getDiscoveredJobs } from "@/actions/automation.actions";
import { DiscoveredInbox } from "@/components/discovered/DiscoveredInbox";

export const dynamic = "force-dynamic";

export default async function DiscoveredPage() {
  const res = await getDiscoveredJobs({
    discoveryStatus: "new",
    sortBy: "matchScore",
    sortOrder: "desc",
    // ponytail: single page, no infinite scroll — add load-more if the
    // unreviewed queue regularly exceeds this.
    limit: 200,
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
      </div>
      <DiscoveredInbox initialJobs={jobs} />
    </div>
  );
}
