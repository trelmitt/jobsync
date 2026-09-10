"use client";

import { useMemo } from "react";
import Link from "next/link";
import MarkdownIt from "markdown-it";
import { format } from "date-fns";
import {
  DollarSign,
  TrendingUp,
  Gem,
  HeartHandshake,
  Home,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TipTapContentViewer } from "@/components/TipTapContentViewer";
import type { JobFacts, JobMatchData } from "@/models/ai.schemas";

const NOT_LISTED = "not listed";

function FactBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const present = value && value.trim().toLowerCase() !== NOT_LISTED;
  return (
    <Badge variant={present ? "secondary" : "outline"} className="gap-1 font-normal">
      <Icon className="h-3 w-3" />
      {present ? (
        <span className="max-w-[220px] truncate">{value}</span>
      ) : (
        <span className="text-muted-foreground">{label}: not listed</span>
      )}
    </Badge>
  );
}

function QuickFacts({ facts }: { facts: JobFacts }) {
  const roleLine =
    facts.role && facts.role.trim().toLowerCase() !== NOT_LISTED ? facts.role : null;
  return (
    <div className="space-y-1.5">
      {roleLine && <p className="text-sm">{roleLine}</p>}
      <div className="flex flex-wrap gap-1.5">
        <FactBadge icon={DollarSign} label="Salary/OTE" value={facts.salary} />
        <FactBadge icon={TrendingUp} label="Bonus/Incentives" value={facts.bonusIncentives} />
        <FactBadge icon={Gem} label="Equity" value={facts.equity} />
        <FactBadge icon={HeartHandshake} label="Benefits" value={facts.benefits} />
        <FactBadge icon={Home} label="Remote" value={facts.remote} />
      </div>
    </div>
  );
}

// html:false escapes any raw HTML in the model output; TipTapContentViewer
// further strips unrecognized tags, so the rendered analysis is safe.
const md = new MarkdownIt({ html: false, linkify: false, breaks: true });

// Legacy matches saved before the markdown refactor have a structured `summary`
// instead of a `body`. Show what we can rather than rendering blank.
interface LegacyMatchData {
  summary?: string;
}

interface MatchDetailsProps {
  matchData: (JobMatchData & LegacyMatchData) | null;
  discoveredAt?: Date;
  // Quick-scan mode for the swipe inbox: clamps the write-up and drops the
  // resume/provider/date footer, which isn't decision-relevant for a swipe.
  compact?: boolean;
}

export function MatchDetails({ matchData, discoveredAt, compact }: MatchDetailsProps) {
  const html = useMemo(
    () => (matchData?.body ? md.render(matchData.body) : ""),
    [matchData?.body],
  );

  if (!matchData) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {matchData.recommendation && (
          <Badge variant="outline" className="capitalize">
            {matchData.recommendation}
          </Badge>
        )}
        {matchData.opportunityScore !== undefined && (
          <Badge
            variant="secondary"
            title="This match blends skills fit with how well the listing fits your stated job preferences."
          >
            Skill {matchData.skillScore}% · Opportunity {matchData.opportunityScore}%
          </Badge>
        )}
        {matchData.descriptionCompleteness &&
          matchData.descriptionCompleteness !== "full" && (
            <Badge
              variant="secondary"
              title="Scored from an incomplete job description — re-run the match after adding the full posting."
            >
              Provisional score
            </Badge>
          )}
      </div>

      {matchData.facts && <QuickFacts facts={matchData.facts} />}

      {html ? (
        <div
          className={`text-sm leading-relaxed [&_p]:mt-2 [&_ul]:mt-2 [&_ol]:mt-2 [&_h2]:mt-4 [&_h2]:font-semibold ${
            compact ? "line-clamp-3 [&_h2]:hidden" : ""
          }`}
        >
          <TipTapContentViewer content={html} />
        </div>
      ) : null}

      {matchData.opportunitySummary && (
        <p
          className={`text-sm text-muted-foreground ${compact ? "line-clamp-2" : ""}`}
        >
          <span className="font-medium text-foreground">Opportunity fit: </span>
          {matchData.opportunitySummary}
        </p>
      )}

      {!html && matchData.summary ? (
        <div className="space-y-2">
          <p className={`text-sm ${compact ? "line-clamp-3" : ""}`}>{matchData.summary}</p>
          {!compact && (
            <p className="text-xs text-muted-foreground italic">
              This match was saved before the latest update. Re-run the match for
              the full breakdown.
            </p>
          )}
        </div>
      ) : null}

      {!compact && (
        <div className="text-xs text-muted-foreground space-y-1">
          {matchData.resumeTitle && (
            <p>
              Matched with resume:{" "}
              {matchData.resumeId ? (
                <Link
                  href={`/dashboard/profile/resume/${matchData.resumeId}`}
                  className="font-medium underline hover:text-foreground"
                >
                  {matchData.resumeTitle}
                </Link>
              ) : (
                <span className="font-medium">{matchData.resumeTitle}</span>
              )}
            </p>
          )}
          {matchData.provider && (
            <p>
              Model:{" "}
              <span className="font-medium">
                {matchData.provider}
                {matchData.model ? ` / ${matchData.model}` : ""}
              </span>
            </p>
          )}
          <p>
            {matchData.matchedAt
              ? `Matched on ${format(new Date(matchData.matchedAt), "MMM d, yyyy 'at' h:mm a")}`
              : discoveredAt
                ? `Discovered on ${format(new Date(discoveredAt), "MMM d, yyyy 'at' h:mm a")}`
                : null}
          </p>
        </div>
      )}
    </div>
  );
}
