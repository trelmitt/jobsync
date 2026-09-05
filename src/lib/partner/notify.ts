import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

// iMessage notifications via Messages.app (osascript). No-op unless enabled and
// a recipient number is configured, and every failure is swallowed so a texting
// problem can never break a web request. Real sends only work on the macOS host
// with Messages signed in (the Mac Mini); anywhere else this silently no-ops.

function enabled(): boolean {
  return process.env.PARTNER_NOTIFY_ENABLED === "true" && process.platform === "darwin";
}

export async function sendIMessage(to: string | undefined, body: string): Promise<void> {
  if (!enabled() || !to) return;
  const script = `on run {targetBuddy, targetMessage}
  tell application "Messages"
    set targetService to 1st account whose service type = iMessage
    set theBuddy to participant targetBuddy of targetService
    send targetMessage to theBuddy
  end tell
end run`;
  try {
    await execFileP("osascript", ["-e", script, to, body], { timeout: 15000 });
  } catch (e) {
    console.error("iMessage send failed", e);
  }
}

export async function notifyOwnerNewSuggestion(url: string, whyMe?: string | null): Promise<void> {
  const line = whyMe ? `\n"${whyMe}"` : "";
  await sendIMessage(process.env.OWNER_IMESSAGE, `New job suggestion to triage:\n${url}${line}`);
}

export async function notifyPartnerSuggestionReply(
  status: string,
  replyNote: string | null,
  url: string,
): Promise<void> {
  const verdict =
    status === "promoted"
      ? "added it to my list"
      : status === "dismissed"
        ? "passed on it"
        : "reviewed it";
  const note = replyNote ? `\n"${replyNote}"` : "";
  await sendIMessage(process.env.PARTNER_IMESSAGE, `Update on the job you sent — I ${verdict}.${note}\n${url}`);
}

export async function notifyPartner(message: string): Promise<void> {
  await sendIMessage(process.env.PARTNER_IMESSAGE, message);
}
