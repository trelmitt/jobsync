"use client";
import { useEffect, useState } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toastSuccess, toastError } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import { getUserSettings, updateApplyProfile } from "@/actions/userSettings.actions";
import { defaultUserSettings, type ApplyProfile } from "@/models/userSettings.model";

// "Unset" is a real, distinct state (not just "No") — until answered, the
// apply engine leaves these questions to the question bank / AI draft.
const TRISTATE_UNSET = "unset";

function tristateToSelect(value: boolean | null): string {
  return value === null ? TRISTATE_UNSET : value ? "yes" : "no";
}

function selectToTristate(value: string): boolean | null {
  return value === TRISTATE_UNSET ? null : value === "yes";
}

function ApplyProfileSettings() {
  const [profile, setProfile] = useState<ApplyProfile>(defaultUserSettings.applyProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const result = await getUserSettings();
        const saved = result?.data?.settings?.applyProfile;
        if (saved) setProfile({ ...defaultUserSettings.applyProfile, ...saved });
      } catch (error) {
        console.error("Error fetching apply profile:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const save = async () => {
    setIsSaving(true);
    try {
      const result = await updateApplyProfile(profile);
      if (result.success) {
        toastSuccess("Apply profile saved successfully.", "Saved!");
      } else {
        toastError(result.message || "Failed to save apply profile.");
      }
    } catch (error) {
      console.error("Error saving apply profile:", error);
      toastError("Failed to save apply profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Apply Profile</h3>
        <p className="text-sm text-muted-foreground">
          Answers the apply engine uses for the most common screening
          questions instead of guessing — work authorization, sponsorship,
          salary, and notice period are too high-stakes to leave to an AI
          draft. Leave a field unset to fall back to your saved question
          answers or an AI draft as before.
        </p>
      </div>

      <div>
        <Label className="mb-2 block">
          Are you legally authorized to work in the country you&apos;re applying in?
        </Label>
        <Select
          value={tristateToSelect(profile.workAuthorized)}
          onValueChange={(v) => setProfile((p) => ({ ...p, workAuthorized: selectToTristate(v) }))}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TRISTATE_UNSET}>Unset</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block">
          Will you now or in the future require visa sponsorship?
        </Label>
        <Select
          value={tristateToSelect(profile.requiresSponsorship)}
          onValueChange={(v) => setProfile((p) => ({ ...p, requiresSponsorship: selectToTristate(v) }))}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TRISTATE_UNSET}>Unset</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block" htmlFor="desired-salary">
          Desired salary
        </Label>
        <Input
          id="desired-salary"
          placeholder="e.g. $150,000-$180,000"
          value={profile.desiredSalary}
          onChange={(e) => setProfile((p) => ({ ...p, desiredSalary: e.target.value }))}
          className="max-w-xs"
        />
      </div>

      <div>
        <Label className="mb-2 block" htmlFor="notice-period">
          Notice period
        </Label>
        <Input
          id="notice-period"
          placeholder="e.g. 2 weeks"
          value={profile.noticePeriod}
          onChange={(e) => setProfile((p) => ({ ...p, noticePeriod: e.target.value }))}
          className="max-w-xs"
        />
      </div>

      <Button className="mt-4" onClick={save} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save
      </Button>
    </div>
  );
}

export default ApplyProfileSettings;
