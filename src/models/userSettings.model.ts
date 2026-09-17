import { AiProvider } from "./ai.model";

export interface AiSettings {
  provider: AiProvider;
  model: string | undefined;
}

export interface DisplaySettings {
  theme: "light" | "dark" | "system";
}

export interface JobPreferences {
  // Free-text description of the opportunities the candidate wants to be
  // steered toward (e.g. "early-stage, AI-focused, equity upside") — fed to
  // the automation match's opportunity-fit pass.
  opportunityProfile: string;
  // 0-100: how much the opportunity-fit score should count toward the final
  // match score. 0 = ignore it entirely (skill fit only, prior behavior).
  opportunityWeight: number;
}

// Authoritative answers for the apply engine's highest-stakes screening
// questions (work authorization, salary, notice period) — answered straight
// from here rather than left to AI drafting, since a guessed answer to one
// of these carries real legal/reputational risk. Empty fields fall through
// to the question bank / AI draft as normal.
export interface ApplyProfile {
  workAuthorized: boolean | null;
  requiresSponsorship: boolean | null;
  desiredSalary: string;
  noticePeriod: string;
}

export interface UserSettingsData {
  ai: AiSettings;
  display: DisplaySettings;
  jobPreferences: JobPreferences;
  applyProfile: ApplyProfile;
}

export interface UserSettings {
  userId: string;
  settings: UserSettingsData;
}

export const defaultUserSettings: UserSettingsData = {
  ai: {
    provider: AiProvider.OLLAMA,
    model: undefined,
  },
  display: {
    theme: "system",
  },
  jobPreferences: {
    opportunityProfile: "",
    opportunityWeight: 30,
  },
  applyProfile: {
    workAuthorized: null,
    requiresSponsorship: null,
    desiredSalary: "",
    noticePeriod: "",
  },
};
