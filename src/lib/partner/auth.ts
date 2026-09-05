import "server-only";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { PARTNER_COOKIE, verifyPartnerToken } from "./session";

// Login throttling lives in ./rate-limit (pure + unit-tested). Re-exported here
// so callers keep importing the whole PIN gate from one module.
export { loginAllowed, recordFailedLogin, clearLoginAttempts } from "./rate-limit";

// PIN gate for the read-only partner area. The PIN is the ONLY wall on a
// public URL, so: hashed at rest (PARTNER_PIN_HASH, bcrypt), constant-time
// compare inside bcrypt, and per-client + global rate-limit + lockout in ./rate-limit.

export async function isPartnerAuthed(): Promise<boolean> {
  const jar = await cookies();
  return verifyPartnerToken(jar.get(PARTNER_COOKIE)?.value);
}

// Defense in depth beyond the layout gate — every partner action/route calls this.
export async function requirePartner(): Promise<void> {
  if (!(await isPartnerAuthed())) throw new Error("Partner not authenticated");
}

export async function verifyPin(pin: string): Promise<boolean> {
  const hash = process.env.PARTNER_PIN_HASH;
  if (!hash) throw new Error("PARTNER_PIN_HASH is not set.");
  if (!pin) return false;
  return bcrypt.compare(pin, hash);
}

// Best-effort client key for the per-key rate-limit bucket. NOTE: x-forwarded-for
// is client-spoofable, so this is only granularity for the common case — the
// spoof-proof backstop is the global bucket in ./rate-limit, not this key.
export async function clientKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || h.get("x-real-ip") || "unknown";
}
