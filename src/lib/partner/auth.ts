import "server-only";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { PARTNER_COOKIE, verifyPartnerToken } from "./session";

// PIN gate for the read-only partner area. The PIN is the ONLY wall on a
// public URL, so: hashed at rest (PARTNER_PIN_HASH, bcrypt), constant-time
// compare inside bcrypt, and per-client rate-limit + lockout below.

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

// --- login rate limit (in-memory, per client key) --------------------------
// ponytail: in-memory, resets on restart — fine for a single container; move
// to the DB if this ever runs multi-instance.
interface Attempt {
  count: number;
  resetTime: number;
  lockedUntil?: number;
}
const attempts = new Map<string, Attempt>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function clientKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || h.get("x-real-ip") || "unknown";
}

export function loginAllowed(key: string): { allowed: boolean; retryInMs: number } {
  const now = Date.now();
  const e = attempts.get(key);
  if (e?.lockedUntil && now < e.lockedUntil) return { allowed: false, retryInMs: e.lockedUntil - now };
  if (!e || now > e.resetTime) return { allowed: true, retryInMs: 0 };
  if (e.count >= MAX_ATTEMPTS) {
    e.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, retryInMs: LOCKOUT_MS };
  }
  return { allowed: true, retryInMs: 0 };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const e = attempts.get(key);
  if (!e || now > e.resetTime) {
    attempts.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return;
  }
  e.count++;
  if (e.count >= MAX_ATTEMPTS) e.lockedUntil = now + LOCKOUT_MS;
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
