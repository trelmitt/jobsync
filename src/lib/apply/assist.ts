import db from "@/lib/db";
import { loadApplyProfile } from "./questionAnswers";
import type { FilledField } from "./types";

// Sites the engine can't fill (Workday's per-company accounts, LinkedIn's
// no-bots terms, anything without an adapter) get the same prep — tailored
// resume, cover letter — plus this copy-paste sheet. No browser ever opens.
export const ASSIST_PLATFORM = "assist";

const yesNo = (v: boolean | null) => (v === null ? null : v ? "Yes" : "No");

export async function buildAnswerSheet(userId: string, resumeId: string): Promise<FilledField[]> {
  const [resume, profile, saved] = await Promise.all([
    db.resume.findFirst({ where: { id: resumeId, profile: { userId } }, include: { ContactInfo: true } }),
    loadApplyProfile(userId),
    db.question.findMany({
      where: { createdBy: userId, answer: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);
  const c = resume?.ContactInfo;
  const rows: FilledField[] = [];
  const add = (label: string, value: string | null | undefined, source: FilledField["source"]) => {
    if (value) rows.push({ label, value, source });
  };

  add("First name", c?.firstName, "resume");
  add("Last name", c?.lastName, "resume");
  add("Email", c?.email, "resume");
  add("Phone", c?.phone, "resume");
  add(c?.url1Label || "Link", c?.url1, "resume");
  add(c?.url2Label || "Link", c?.url2, "resume");
  add("Authorized to work", yesNo(profile.workAuthorized), "profile");
  add("Requires sponsorship", yesNo(profile.requiresSponsorship), "profile");
  add("Desired salary", profile.desiredSalary, "profile");
  add("Notice period", profile.noticePeriod, "profile");
  for (const q of saved) add(q.question, q.answer, q.createdVia === "apply-engine" ? "ai_draft" : "question_bank");
  return rows;
}
