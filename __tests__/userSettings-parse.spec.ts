const { db, warn } = vi.hoisted(() => ({
  db: { userSettings: { findUnique: vi.fn() } },
  warn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/telemetry", () => ({ log: { warn, info: vi.fn(), error: vi.fn() } }));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/ai", () => ({ getModel: vi.fn() }));

import { parseUserSettings } from "@/lib/userSettings";
import { getUserAiSettings, getUserJobPreferences } from "@/lib/scraper/automation-run/aiSettings";
import { loadApplyProfile } from "@/lib/apply/questionAnswers";
import { defaultUserSettings } from "@/models/userSettings.model";

describe("malformed UserSettings JSON", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.userSettings.findUnique.mockResolvedValue({ userId: "user1", settings: "{not json" });
  });

  it("getUserAiSettings returns the default AI settings", async () => {
    expect(await getUserAiSettings("user1")).toEqual(defaultUserSettings.ai);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Malformed"), { userId: "user1" });
  });

  it("getUserJobPreferences returns the default job preferences", async () => {
    expect(await getUserJobPreferences("user1")).toEqual(defaultUserSettings.jobPreferences);
  });

  it("loadApplyProfile returns the default apply profile", async () => {
    expect(await loadApplyProfile("user1")).toEqual(defaultUserSettings.applyProfile);
  });

  it("treats valid JSON that isn't an object as empty, and passes a real object through", () => {
    for (const settings of ["null", "[1]", '"text"', "42"]) {
      expect(parseUserSettings({ userId: "u", settings })).toEqual({});
    }
    expect(warn).toHaveBeenCalledTimes(4);
    expect(parseUserSettings({ userId: "u", settings: '{"ai":{"model":"m"}}' })).toEqual({ ai: { model: "m" } });
    expect(warn).toHaveBeenCalledTimes(4);
  });
});
