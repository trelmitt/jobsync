import "server-only";

// Web-Crypto-signed session cookie for the read-only partner area.
// Deliberately separate from NextAuth: the partner is NOT a User. The cookie
// only asserts "someone entered the correct PIN" — it carries no identity and
// no data. HMAC-SHA256 keeps it edge-safe (usable from middleware later).

const encoder = new TextEncoder();

function b64urlFromBytes(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToString(b64: string): string {
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return atob(b64.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64urlFromBytes(sig);
}

// Constant-time compare so a wrong signature can't be timed byte-by-byte.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const PARTNER_COOKIE = "partner_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — she shouldn't re-PIN daily

function secret(): string {
  const s = process.env.PARTNER_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("PARTNER_SESSION_SECRET is not set (min 16 chars).");
  }
  return s;
}

export async function createPartnerToken(): Promise<{ token: string; maxAge: number }> {
  const payload = b64urlFromBytes(encoder.encode(JSON.stringify({ exp: Date.now() + TTL_MS })));
  const sig = await sign(payload, secret());
  return { token: `${payload}.${sig}`, maxAge: Math.floor(TTL_MS / 1000) };
}

export async function verifyPartnerToken(token: string | undefined | null): Promise<boolean> {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  let expected: string;
  try {
    expected = await sign(payload, secret());
  } catch {
    return false; // misconfigured secret ⇒ fail closed
  }
  if (!timingSafeEqual(sig, expected)) return false;
  try {
    const { exp } = JSON.parse(b64urlToString(payload));
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}
