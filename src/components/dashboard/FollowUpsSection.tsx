"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { addNote } from "@/actions/note.actions";
import { toastActionResult } from "@/lib/toast";

type FollowUp = {
  id: string;
  step: number;
  JobTitle?: { label: string } | null;
  Company?: { label: string } | null;
};

const STEP_LABEL: Record<number, string> = {
  3: "Day 3: check in",
  7: "Day 7: follow up",
  14: "Day 14: last nudge",
};

export function FollowUpsSection({ jobs }: { jobs: FollowUp[] }) {
  // Derived from props so a refresh shows newly due jobs; the key includes the
  // step so logging day 3 doesn't hide day 7 for the same job.
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const list = jobs.filter((j) => !done.has(`${j.id}:${j.step}`));
  const [isPending, startTransition] = useTransition();

  if (list.length === 0) return null;

  // The note is the record of the touch; it's what clears this step.
  const handleDone = (job: FollowUp) => {
    startTransition(async () => {
      const result = await addNote({ jobId: job.id, content: `Followed up (day ${job.step})` });
      toastActionResult(result, {
        success: "Follow-up logged",
        onSuccess: () => setDone((prev) => new Set(prev).add(`${job.id}:${job.step}`)),
      });
    });
  };

  return (
    <div className="@3xl/main:col-span-2">
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">
        Follow-ups due
      </h2>
      <div className="grid gap-2 @lg:grid-cols-2">
        {list.map((job) => (
          <Card key={job.id}>
            <CardContent className="flex items-center justify-between gap-2 p-3">
              <Link href={`/dashboard/myjobs/${job.id}`} className="min-w-0 hover:underline">
                <div className="truncate text-sm font-medium">
                  {job.JobTitle?.label ?? "Role"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {job.Company?.label ?? ""}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{STEP_LABEL[job.step]}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleDone(job)}
                >
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
