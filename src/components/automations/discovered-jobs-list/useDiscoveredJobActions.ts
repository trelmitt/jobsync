"use client";

import { useState, useEffect } from "react";
import { toastSuccess, toastError } from "@/lib/toast";
import type { DiscoveredJob } from "@/models/automation.model";
import {
  acceptDiscoveredJob,
  dismissDiscoveredJob,
  analyzeDiscoveredJob,
} from "@/actions/automation.actions";

// Per-job analyze/accept/dismiss, serialized through a single loading id so the
// parent can also block starting a run while one is in flight.
export function useDiscoveredJobActions(
  onRefresh: () => void,
  onBusyChange?: (busy: boolean) => void,
) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

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
    setLoadingAction(null);
    if (done > 0) {
      toastSuccess(`${done} of ${jobIds.length} job(s) analyzed.`, "Match analyzed");
      onRefresh();
    }
  };

  const handleAccept = async (job: DiscoveredJob) => {
    setLoadingAction(job.id);
    try {
      const result = await acceptDiscoveredJob(job.id);
      if (result.success) {
        toastSuccess("The job has been added to your tracked jobs.", "Job accepted");
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
