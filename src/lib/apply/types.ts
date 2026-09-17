import type { Page } from "playwright-core";
import type { JobBoard } from "@/models/automation.model";

export type ApplySessionStatus =
  | "queued"
  | "filling"
  | "needs_review"
  | "submitted"
  | "failed"
  | "blocked"
  | "expired"
  | "cancelled";

export type BlockedReason =
  | "captcha_detected"
  | "session_expired"
  | "selector_mismatch"
  | "closed_position"
  | "login_required";

// One field the engine touched on the real application form. `source` records
// where the value came from so the review UI can flag AI-drafted answers
// (the ones that most need a human read before Submit) distinctly from
// values pulled straight off the resume/profile.
export interface FilledField {
  label: string;
  value: string;
  source: "resume" | "profile" | "question_bank" | "ai_draft" | "skipped_eeo";
}

export interface ApplyContext {
  applySessionId: string;
  userId: string;
  resumeFilePath: string;
  applicantName: { first: string; last: string };
  email: string;
  phone?: string;
  log: (message: string, metadata?: Record<string, unknown>) => void;
}

export interface ApplyResult {
  fieldsFilled: FilledField[];
  screenshotPaths: string[];
  blockedReason?: BlockedReason;
}

// An adapter fills every field it can and stops one page-state before the
// real Submit button is clicked. It never clicks Submit itself — see
// runner.ts and the /api/apply/[id]/submit route, the only code path allowed
// to do that.
export interface ApplyAdapter {
  platform: JobBoard;
  matches: (applicationUrl: string) => boolean;
  fill: (page: Page, ctx: ApplyContext) => Promise<ApplyResult>;
  submit: (page: Page) => Promise<void>;
}
