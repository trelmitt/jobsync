import {
  getPartnerMomentum,
  getSharedJobs,
  getVentures,
  getPartnerSuggestions,
} from "@/lib/partner/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SuggestForm } from "@/components/partner/SuggestForm";
import { Briefcase, TrendingUp, Building2, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const STAGE_ORDER = ["offer", "interview", "applied", "new", "draft"];
const STAGE_LABEL: Record<string, string> = {
  offer: "Offers",
  interview: "Interviewing",
  applied: "Applied",
  new: "New",
  draft: "Draft",
};

function SuggestionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    new: { label: "Waiting", variant: "outline" },
    reviewed: { label: "Reviewed", variant: "secondary" },
    promoted: { label: "On his list", variant: "default" },
    dismissed: { label: "Passed", variant: "secondary" },
  };
  const m = map[status] ?? map.new;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export default async function PartnerDashboard() {
  const [momentum, jobs, ventures, suggestions] = await Promise.all([
    getPartnerMomentum(),
    getSharedJobs(),
    getVentures(),
    getPartnerSuggestions(),
  ]);

  const tiles = [
    { label: "Total tracked", value: momentum.totalTracked, icon: Briefcase },
    { label: "Added this week", value: momentum.addedThisWeek, icon: TrendingUp },
    { label: "Companies", value: momentum.companies, icon: Building2 },
    { label: "Roles", value: momentum.roles, icon: FileText },
  ];

  const byStage = new Map<string, typeof jobs>();
  for (const j of jobs) {
    const k = j.Status?.value ?? "new";
    const arr = byStage.get(k) ?? [];
    arr.push(j);
    byStage.set(k, arr);
  }
  const stages = STAGE_ORDER.filter((s) => byStage.has(s));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Momentum</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label}>
              <CardContent className="p-4">
                <t.icon className="mb-2 h-4 w-4 text-muted-foreground" />
                <div className="text-2xl font-semibold">{t.value}</div>
                <div className="text-xs text-muted-foreground">{t.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {ventures.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Ventures &amp; other work
          </h2>
          <div className="space-y-3">
            {ventures.map((v) => (
              <Card key={v.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{v.name}</span>
                    <Badge variant={v.kind === "advisory" ? "secondary" : "default"}>
                      {v.kind}
                    </Badge>
                  </div>
                  {v.summary && (
                    <p className="mt-1 text-sm text-muted-foreground">{v.summary}</p>
                  )}
                  {v.status && (
                    <p className="mt-2 text-xs text-muted-foreground">Status: {v.status}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Job pipeline</h2>
        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing shared here yet.</p>
        ) : (
          <div className="space-y-4">
            {stages.map((s) => (
              <div key={s}>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {STAGE_LABEL[s] ?? s}
                </div>
                <div className="space-y-2">
                  {byStage.get(s)!.map((j) => (
                    <Card key={j.id}>
                      <CardContent className="flex items-center justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {j.JobTitle?.label ?? "Role"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {j.Company?.label ?? ""}
                          </div>
                        </div>
                        <Badge variant="outline">{j.Status?.label ?? s}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Found a job for him?
        </h2>
        <Card>
          <CardContent className="p-4">
            <SuggestForm />
          </CardContent>
        </Card>

        {suggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Jobs you&apos;ve sent
            </h3>
            {suggestions.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm underline"
                    >
                      {s.url}
                    </a>
                    <SuggestionStatusBadge status={s.status} />
                  </div>
                  {s.whyMe && (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      &ldquo;{s.whyMe}&rdquo;
                    </p>
                  )}
                  {s.replyNote && <p className="mt-1 text-sm">He says: {s.replyNote}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
