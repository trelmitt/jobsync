"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError } from "@/lib/toast";
import type { DiscoveredJob } from "@/models/automation.model";
import {
  acceptDiscoveredJob,
  dismissDiscoveredJob,
  analyzeDiscoveredJob,
} from "@/actions/automation.actions";
import { startPreparedApply } from "@/components/apply/startPreparedApply";

// Per-job analyze/accept/dismiss, serialized through a single loading id so the
// parent can also block starting a run while one is in flight.
export function useDiscoveredJobActions(
  onRefresh: () => void | Promise<void>,
  onBusyChange?: (busy: boolean) => void,
) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    onBusyChange?.(loadingAction !== null);
  }, [loadingAction, onBusyChange]);

  const handleAnalyze = async (jobId: string) => {
    setLoadingAction(jobId);
    try {
      const result = await analyzeDiscoveredJob(jobId);
      if (result.success) {
        toastSuccess("AI match score is ready.", "Match analyzed");
        onRefresh();
      } else {
        toastError(result.message);
      }
    } catch {
      toastError("Failed to analyze job");
    } finally {
      setLoadingAction(null);
    }
  };

  // One LLM call at a time, same as clicking Analyze on each row. Stops at
  // the first failure so a provider outage shows one error, not one per job.
  const handleAnalyzeAll = async (jobIds: string[]) => {
    let done = 0;
    for (const jobId of jobIds) {
      setLoadingAction(jobId);
      try {
        const result = await analyzeDiscoveredJob(jobId);
        if (!result.success) {
          toastError(result.message);
          break;
        }
        done++;
      } catch {
        toastError("Failed to analyze job");
        break;
      }
    }
    if (done > 0) {
      toastSuccess(`${done} of ${jobIds.length} job(s) analyzed.`, "Match analyzed");
      // Stay busy until the list reloads, or a quick second click would
      // resubmit the rows that were just analyzed.
      await onRefresh();
    }
    setLoadingAction(null);
  };

  const handleAccept = async (job: DiscoveredJob) => {
    setLoadingAction(job.id);
    try {
      const result = await acceptDiscoveredJob(job.id);
      if (result.success) {
        // Accepting kicks off the prep pipeline; the review page shows its
        // progress. Unsupported sites (or the engine off) just stay accepted.
        const started = await startPreparedApply(job.id, job.resumeId);
        if (started.id) {
          toastSuccess("Tailoring your resume and filling the application for review.", "Job accepted");
          router.push(`/dashboard/apply/${started.id}`);
          return;
        }
        toastSuccess(
          started.engineOff
            ? "The job has been added to your tracked jobs."
            : `Added to your tracked jobs. Auto-prep unavailable: ${started.message}`,
          "Job accepted",
        );
        onRefresh();
      } else {
        toastError(result.message);
      }
    } catch {
      toastError("Failed to accept job");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDismiss = async (jobId: string) => {
    setLoadingAction(jobId);
    try {
      const result = await dismissDiscoveredJob(jobId);
      if (result.success) {
        toastSuccess("Job dismissed");
        onRefresh();
      } else {
        toastError(result.message);
      }
    } catch {
      toastError("Failed to dismiss job");
    } finally {
      setLoadingAction(null);
    }
  };

  return { loadingAction, handleAnalyze, handleAnalyzeAll, handleAccept, handleDismiss };
}
