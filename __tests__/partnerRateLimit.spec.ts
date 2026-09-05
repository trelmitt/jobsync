// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import {
  loginAllowed,
  recordFailedLogin,
  clearLoginAttempts,
  __resetRateLimiter,
} from "@/lib/partner/rate-limit";

describe("partner login rate limit", () => {
  beforeEach(() => __resetRateLimiter());

  it("closes the x-forwarded-for rotation bypass: distinct keys still trip the global cap", () => {
    // Attacker rotates the client key on every guess, so each per-key bucket
    // stays at 1 — the old code let this brute-force forever.
    for (let i = 0; i < 10; i++) recordFailedLogin(`1.2.3.${i}`);
    // A brand-new key must now be blocked by the spoof-proof global bucket.
    expect(loginAllowed("9.9.9.9").allowed).toBe(false);
  });

  it("allows a legit user still under the per-key limit", () => {
    recordFailedLogin("10.0.0.1");
    recordFailedLogin("10.0.0.1");
    expect(loginAllowed("10.0.0.1").allowed).toBe(true);
  });

  it("locks a single key after MAX_ATTEMPTS", () => {
    for (let i = 0; i < 5; i++) recordFailedLogin("10.0.0.2");
    expect(loginAllowed("10.0.0.2").allowed).toBe(false);
  });

  it("clears the global bucket on a successful login so the partner isn't left locked out", () => {
    for (let i = 0; i < 10; i++) recordFailedLogin(`8.8.8.${i}`);
    expect(loginAllowed("fresh").allowed).toBe(false);
    clearLoginAttempts("fresh"); // success path
    expect(loginAllowed("fresh").allowed).toBe(true);
  });
});
