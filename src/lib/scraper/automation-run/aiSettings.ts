import pLimit from "p-limit";
import db from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";
import { parseUserSettings } from "@/lib/userSettings";
import {
  AiProvider,
  OllamaModel,
  OpenaiModel,
  DeepseekModel,
  GeminiModel,
  AnthropicModel,
} from "@/models/ai.model";
import {
  defaultUserSettings,
  type AiSettings,
  type JobPreferences,
} from "@/models/userSettings.model";

// Ollama serializes on the GPU, so it must process matches one at a time;
// other providers can fan out concurrently.
export function getAutomationMatchLimit(provider: AiProvider) {
  const concurrency =
    provider === AiProvider.OLLAMA
      ? 1
      : APP_CONSTANTS.AUTOMATION_MATCH_CONCURRENCY;
  return pLimit(concurrency);
}

export function getDefaultModelForProvider(provider: AiProvider): string {
  switch (provider) {
    case AiProvider.OLLAMA:
      return OllamaModel.LLAMA3_2;
    case AiProvider.OPENAI:
      return OpenaiModel.GPT4O_MINI;
    case AiProvider.DEEPSEEK:
      return DeepseekModel.DEEPSEEK_CHAT;
    case AiProvider.GEMINI:
      return GeminiModel.GEMINI_2_0_FLASH;
    case AiProvider.OPENROUTER:
      return "anthropic/claude-3.5-sonnet";
    case AiProvider.ANTHROPIC:
      return AnthropicModel.CLAUDE_SONNET_5;
    case AiProvider.MACENGINE:
      // No fixed catalog (models are whatever's locally loaded) — unlike the
      // other providers there's no safe default to guess, so require the
      // user to have picked one in AI Settings.
      throw new Error(
        "No model selected for macengine. Please choose a model in AI Settings.",
      );
  }
}

export async function getUserAiSettings(userId: string): Promise<AiSettings> {
  const userSettings = await db.userSettings.findUnique({
    where: { userId },
  });

  if (!userSettings) {
    return defaultUserSettings.ai;
  }

  const settings = parseUserSettings(userSettings);
  return {
    ...defaultUserSettings.ai,
    ...settings.ai,
  };
}

export async function getUserJobPreferences(
  userId: string,
): Promise<JobPreferences> {
  const userSettings = await db.userSettings.findUnique({
    where: { userId },
  });

  if (!userSettings) {
    return defaultUserSettings.jobPreferences;
  }

  const settings = parseUserSettings(userSettings);
  return {
    ...defaultUserSettings.jobPreferences,
    ...settings.jobPreferences,
  };
}
