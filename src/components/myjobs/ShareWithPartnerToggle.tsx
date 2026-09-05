"use client";
import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toggleJobShared } from "@/actions/job.actions";
import { toastError } from "@/lib/toast";

// Owner control: show this job as a card on the partner dashboard. Optimistic;
// reverts on failure.
export function ShareWithPartnerToggle({
  jobId,
  initial,
}: {
  jobId: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  const change = (next: boolean) => {
    setOn(next);
    start(async () => {
      const res = await toggleJobShared(jobId, next);
      if (!res?.success) {
        setOn(!next);
        toastError(res?.message);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={`share-${jobId}`}
        checked={on}
        onCheckedChange={change}
        disabled={pending}
      />
      <Label htmlFor={`share-${jobId}`} className="text-sm text-muted-foreground">
        Share with partner
      </Label>
    </div>
  );
}
