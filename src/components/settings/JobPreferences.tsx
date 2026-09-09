"use client";
import { useEffect, useState } from "react";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Slider } from "../ui/slider";
import { Button } from "../ui/button";
import { toastSuccess, toastError } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import { getUserSettings, updateJobPreferences } from "@/actions/userSettings.actions";
import { defaultUserSettings } from "@/models/userSettings.model";

function JobPreferences() {
  const [opportunityProfile, setOpportunityProfile] = useState("");
  const [opportunityWeight, setOpportunityWeight] = useState(
    defaultUserSettings.jobPreferences.opportunityWeight,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const result = await getUserSettings();
        const prefs = result?.data?.settings?.jobPreferences;
        if (prefs) {
          setOpportunityProfile(prefs.opportunityProfile ?? "");
          setOpportunityWeight(prefs.opportunityWeight ?? defaultUserSettings.jobPreferences.opportunityWeight);
        }
      } catch (error) {
        console.error("Error fetching job preferences:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const save = async () => {
    setIsSaving(true);
    try {
      const result = await updateJobPreferences({ opportunityProfile, opportunityWeight });
      if (result.success) {
        toastSuccess("Job preferences saved successfully.", "Saved!");
      } else {
        toastError(result.message || "Failed to save job preferences.");
      }
    } catch (error) {
      console.error("Error saving job preferences:", error);
      toastError("Failed to save job preferences.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Job Preferences</h3>
          <p className="text-sm text-muted-foreground">
            Describe the kinds of opportunities you&apos;re looking for.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Job Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Automations score every job on skills fit against your resume. Describe
          the kinds of opportunities you&apos;re chasing beyond skills — company stage,
          AI focus, equity upside, etc. — and it factors into the match score too.
        </p>
      </div>
      <div>
        <Label className="my-4" htmlFor="opportunity-profile">
          What are you looking for?
        </Label>
        <Textarea
          id="opportunity-profile"
          placeholder="e.g. Early-stage, AI-focused or AI-enabled companies with immediate or near-term equity/share opportunities. I want to get in on the ground floor of promising ideas."
          value={opportunityProfile}
          onChange={(e) => setOpportunityProfile(e.target.value)}
          rows={5}
        />
      </div>
      <div>
        <Label className="my-4" htmlFor="opportunity-weight">
          How much should this affect your match score? {opportunityWeight}%
        </Label>
        <p className="text-sm text-muted-foreground mb-2">
          0% ignores this entirely (skills fit only). Higher values weigh it more
          heavily against skills fit in the final match score.
        </p>
        <Slider
          id="opportunity-weight"
          min={0}
          max={100}
          step={5}
          value={[opportunityWeight]}
          onValueChange={(next) => setOpportunityWeight(next[0])}
          className="max-w-md"
        />
      </div>
      <Button className="mt-4" onClick={save} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save
      </Button>
    </div>
  );
}

export default JobPreferences;
