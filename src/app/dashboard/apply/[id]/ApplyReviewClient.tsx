"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { getApplySessionStatusBadgeColor } from "@/lib/badge-colors";
import { toastError, toastSuccess } from "@/lib/toast";
import { Loader2, ExternalLink } from "lucide-react";

interface FilledField {
  label: string;
  value: string;
  source: string;
}

interface ApplySessionDetail {
  id: string;
  status: string;
  jobId: string;
  resumeId: string;
  applicationUrl: string;
  blockedReason: string | null;
  errorMessage: string | null;
  fieldsFilled: string | null;
  Job: { JobTitle: { label: string }; Company: { label: string } };
  Resume: { id: string; title: string };
}

interface ApplyReviewClientProps {
  session: ApplySessionDetail;
}

// AI-drafted answers carry real reputational risk if not actually read
// before submitting (per the plan) — call them out distinctly rather than
// blending them into a flat table.
const SOURCE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  resume: { label: "resume", variant: "secondary" },
  profile: { label: "profile", variant: "secondary" },
  question_bank: { label: "saved answer", variant: "secondary" },
  ai_draft: { label: "AI drafted — review", variant: "default" },
  skipped_eeo: { label: "left blank", variant: "outline" },
};

export default function ApplyReviewClient({ session: initial }: ApplyReviewClientProps) {
  const router = useRouter();
  const [session, setSession] = useState(initial);
  // router.refresh() re-runs the server action and passes a new `initial`
  // prop, but useState only reads it on mount — sync it explicitly so a
  // status transition picked up by the poll below actually re-renders.
  useEffect(() => setSession(initial), [initial]);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refilling, setRefilling] = useState(false);

  const inProgress = session.status === "queued" || session.status === "filling";

  useEffect(() => {
    if (!inProgress) return;
    // Poll the row rather than wiring an SSE consumer just for one field —
    // the automations page's live log stream is worth it for a minutes-long
    // run; a fill takes seconds and only needs a status transition.
    const statusInterval = setInterval(async () => {
      const res = await fetch(`/api/apply/${session.id}/status`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      if (data?.status && data.status !== session.status) {
        router.refresh();
      }
    }, 2000);
    return () => clearInterval(statusInterval);
  }, [inProgress, session.id, session.status, router]);

  const fields: FilledField[] = session.fieldsFilled ? JSON.parse(session.fieldsFilled) : [];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/apply/${session.id}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toastError(data.message || "Failed to submit");
        return;
      }
      toastSuccess("Application submitted");
      setSession((s) => ({ ...s, status: "submitted" }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await fetch(`/api/apply/${session.id}/cancel`, { method: "POST" });
      setSession((s) => ({ ...s, status: "cancelled" }));
    } finally {
      setCancelling(false);
    }
  };

  const handleRefill = async () => {
    setRefilling(true);
    try {
      const res = await fetch(`/api/apply/${session.jobId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: session.resumeId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toastError(data.message || "Failed to start refill");
        return;
      }
      router.push(`/dashboard/apply/${data.id}`);
    } finally {
      setRefilling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {session.Job.JobTitle.label} — {session.Job.Company.label}
          </span>
          <StatusBadge
            label={session.status.replace("_", " ")}
            color={getApplySessionStatusBadgeColor(session.status)}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <a
          href={session.applicationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Open application <ExternalLink className="h-3.5 w-3.5" />
        </a>

        {inProgress && (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            Filling application…
          </div>
        )}

        {session.status === "blocked" && (
          <p className="text-red-600 dark:text-red-400">
            Blocked: {session.blockedReason ?? "unknown reason"}. Open the
            application above and finish it yourself.
          </p>
        )}

        {session.status === "failed" && (
          <p className="text-red-600 dark:text-red-400">
            Failed: {session.errorMessage ?? "unknown error"}
          </p>
        )}

        {session.status === "expired" && (
          <p className="text-muted-foreground">
            The review window expired. Refill to try again.
          </p>
        )}

        {(session.status === "needs_review" || session.status === "submitted") && (
          <>
            <img
              src={`/api/apply/${session.id}/screenshot`}
              alt="Application screenshot"
              className="w-full rounded-md border"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, i) => {
                  const source = SOURCE_LABELS[field.source] ?? { label: field.source, variant: "outline" as const };
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{field.label}</TableCell>
                      <TableCell className="max-w-md truncate">{field.value}</TableCell>
                      <TableCell>
                        <Badge variant={source.variant}>{source.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}

        <div className="flex gap-2 justify-end">
          {session.status === "needs_review" && (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={cancelling}>
                Discard
              </Button>
              <Button variant="outline" onClick={handleRefill} disabled={refilling}>
                {refilling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Refill
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Application
              </Button>
            </>
          )}
          {(session.status === "blocked" || session.status === "failed" || session.status === "expired") && (
            <Button variant="outline" onClick={handleRefill} disabled={refilling}>
              {refilling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Refill
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
