"use client";

import { useMemo, useState } from "react";
import { useSpring, animated } from "@react-spring/web";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircularScore } from "@/components/CircularScore";
import { MatchDetails } from "@/components/automations/MatchDetails";
import { toastError } from "@/lib/toast";
import {
  Building2,
  MapPin,
  ExternalLink,
  X,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { DiscoveredJob } from "@/models/automation.model";
import { getWorkplaceTypeLabel } from "@/models/job.model";
import {
  dismissDiscoveredJob,
  acceptDiscoveredJob,
  applyDiscoveredJob,
  undoDiscoveredJobTriage,
} from "@/actions/automation.actions";

type SwipeAction = "dismiss" | "hold" | "apply";

const EXIT_TARGET: Record<SwipeAction, { x: number; y: number; rotate: number }> = {
  dismiss: { x: -600, y: 0, rotate: -20 },
  hold: { x: 0, y: -500, rotate: 0 },
  apply: { x: 600, y: 0, rotate: 20 },
};

const ACTION_FN: Record<SwipeAction, (id: string) => Promise<{ success: boolean; message?: string }>> = {
  dismiss: dismissDiscoveredJob,
  hold: acceptDiscoveredJob,
  apply: applyDiscoveredJob,
};

const ACTION_LABEL: Record<SwipeAction, string> = {
  dismiss: "Dismissed",
  hold: "On hold",
  apply: "Marked applied",
};

interface DiscoveredInboxProps {
  initialJobs: DiscoveredJob[];
}

export function DiscoveredInbox({ initialJobs }: DiscoveredInboxProps) {
  const [queue, setQueue] = useState(initialJobs);
  const [pending, setPending] = useState(false);
  const current = queue[0];

  const [style, api] = useSpring(() => ({ x: 0, y: 0, rotate: 0, opacity: 1 }));

  const parsedMatchData = useMemo(() => {
    if (!current?.matchData) return null;
    try {
      return JSON.parse(current.matchData);
    } catch {
      return null;
    }
  }, [current?.matchData]);

  const runAction = async (action: SwipeAction) => {
    if (!current || pending) return;
    setPending(true);

    await api.start({ ...EXIT_TARGET[action], opacity: 0, config: { tension: 250, friction: 25 } });

    const acted = current;
    const result = await ACTION_FN[action](acted.id);

    if (!result.success) {
      toastError(result.message);
      api.set({ x: 0, y: 0, rotate: 0, opacity: 1 });
      setPending(false);
      return;
    }

    setQueue((q) => q.slice(1));
    api.set({ x: 0, y: 0, rotate: 0, opacity: 0 });
    api.start({ opacity: 1, config: { tension: 250, friction: 25 } });
    setPending(false);

    toast(ACTION_LABEL[action], {
      description: acted.JobTitle.label,
      action: {
        label: "Undo",
        onClick: async () => {
          const undoResult = await undoDiscoveredJobTriage(acted.id);
          if (undoResult.success) {
            setQueue((q) => [acted, ...q]);
          } else {
            toastError(undoResult.message);
          }
        },
      },
    });
  };

  if (!current) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">You&apos;re all caught up</h3>
          <p className="text-muted-foreground mt-2">
            No new discovered jobs to review right now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        {queue.length} job{queue.length === 1 ? "" : "s"} to review
      </p>

      <animated.div style={style}>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="truncate">{current.JobTitle.label}</span>
                  {current.jobUrl && (
                    <a
                      href={current.jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {current.Company.label}
                  </span>
                  {current.Location?.label && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {current.Location.label}
                    </span>
                  )}
                  {current.workplaceType && (
                    <Badge variant="outline" className="text-xs">
                      {getWorkplaceTypeLabel(current.workplaceType, current.workplaceType)}
                    </Badge>
                  )}
                </div>
                {current.automation?.name && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    via {current.automation.name}
                  </p>
                )}
              </div>
              <CircularScore score={current.matchScore} size="md" animate={false} />
            </div>

            <div className="max-h-[40vh] overflow-y-auto">
              <MatchDetails matchData={parsedMatchData} discoveredAt={current.discoveredAt} />
            </div>
          </CardContent>
        </Card>
      </animated.div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="lg" onClick={() => runAction("dismiss")} disabled={pending}>
          <X className="h-5 w-5 mr-1.5" />
          Dismiss
        </Button>
        <Button variant="secondary" size="lg" onClick={() => runAction("hold")} disabled={pending}>
          <Clock className="h-5 w-5 mr-1.5" />
          Hold
        </Button>
        <Button size="lg" onClick={() => runAction("apply")} disabled={pending}>
          <CheckCircle2 className="h-5 w-5 mr-1.5" />
          Apply
        </Button>
      </div>
    </div>
  );
}
