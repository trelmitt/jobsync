// In-memory login rate-limit + lockout for the partner PIN gate.
//
// SECURITY: the per-client key (derived from x-forwarded-for) is attacker-
// spoofable, so a single client can dodge the per-key limit by rotating the
// header on every guess. The GLOBAL bucket is the real backstop — it counts
// every failed login regardless of key, so distributed header-rotation still
// trips a lockout. A login is blocked when EITHER bucket is tripped.
//
// ponytail: in-memory, resets on process restart, single-container only — move
// to the DB if this ever runs multi-instance. A tripped global lock also briefly
// DoSes the (read-only) partner page during an active attack — accepted vs. an
// unthrottled PIN wall; keep the PIN long (>=8 chars / >=6 digits) so the
// 10-tries-per-15-min ceiling stays infeasible to brute-force.

interface Attempt {
  count: number;
  resetTime: number;
  lockedUntil?: number;
}

const attempts = new Map<string, Attempt>();
const MAX_ATTEMPTS = 5; // per client key
const GLOBAL_KEY = "__global__";
const GLOBAL_MAX_ATTEMPTS = 10; // across ALL keys — the spoof-proof cap
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

// Evaluate one bucket; arms its lockout when the threshold is reached.
function bucketAllowed(
  key: string,
  max: number,
  now: number,
): { allowed: boolean; retryInMs: number } {
  const e = attempts.get(key);
  if (e?.lockedUntil && now < e.lockedUntil) return { allowed: false, retryInMs: e.lockedUntil - now };
  if (!e || now > e.resetTime) return { allowed: true, retryInMs: 0 };
  if (e.count >= max) {
    e.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, retryInMs: LOCKOUT_MS };
  }
  return { allowed: true, retryInMs: 0 };
}

function bump(key: string, max: number, now: number): void {
  const e = attempts.get(key);
  if (!e || now > e.resetTime) {
    attempts.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return;
  }
  e.count++;
  if (e.count >= max) e.lockedUntil = now + LOCKOUT_MS;
}

export function loginAllowed(key: string): { allowed: boolean; retryInMs: number } {
  const now = Date.now();
  const perKey = bucketAllowed(key, MAX_ATTEMPTS, now);
  const global = bucketAllowed(GLOBAL_KEY, GLOBAL_MAX_ATTEMPTS, now);
  if (perKey.allowed && global.allowed) return { allowed: true, retryInMs: 0 };
  return { allowed: false, retryInMs: Math.max(perKey.retryInMs, global.retryInMs) };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  bump(key, MAX_ATTEMPTS, now);
  bump(GLOBAL_KEY, GLOBAL_MAX_ATTEMPTS, now);
}

// Called only after a correct PIN. Clears the per-key bucket and the global one
// so accumulated attacker failures don't keep the legitimate partner locked out.
export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
  attempts.delete(GLOBAL_KEY);
}

// test-only: reset module state between cases.
export function __resetRateLimiter(): void {
  attempts.clear();
}
