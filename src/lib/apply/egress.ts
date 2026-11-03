import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { BrowserContext } from "playwright-core";

// The apply browser loads arbitrary third-party job pages, but the container
// can also reach the host (Ollama, macengine via host.docker.internal) and the
// tailnet. Keep those pages from turning the browser into a pivot onto them:
// any request to a loopback, private, link-local or CGNAT (Tailscale) address,
// or to an internal-only hostname, is aborted.

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "host.docker.internal",
  "gateway.docker.internal",
]);
const BLOCKED_SUFFIXES = [".localhost", ".internal", ".local", ".ts.net"];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((n, octet) => (n << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT, used by Tailscale
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3], // multicast + reserved
];

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => {
      const mask = (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      v6 === "::" ||
      v6 === "::1" ||
      /^f[cd]/.test(v6) || // fc00::/7 unique local
      /^fe[89ab]/.test(v6) || // fe80::/10 link-local
      v6.startsWith("ff") // multicast
    );
  }
  return false;
}

export async function isBlockedUrl(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)) {
    return false;
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return true;
  }
  if (isIP(host)) return isPrivateAddress(host);
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.some(({ address }) => isPrivateAddress(address));
  } catch {
    // Unresolvable here means Chromium can't reach it either.
    return false;
  }
}

export async function guardEgress(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    if (await isBlockedUrl(route.request().url())) {
      await route.abort("blockedbyclient");
    } else {
      await route.fallback();
    }
  });
  await context.routeWebSocket(/.*/, async (ws) => {
    if (await isBlockedUrl(ws.url())) {
      await ws.close();
    } else {
      ws.connectToServer();
    }
  });
}
