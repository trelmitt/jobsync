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

export interface UserSettingsData {
  ai: AiSettings;
  display: DisplaySettings;
  jobPreferences: JobPreferences;
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
};
