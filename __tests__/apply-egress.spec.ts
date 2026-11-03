const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup, default: { lookup } }));

import { isBlockedUrl, isPrivateAddress } from "@/lib/apply/egress";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.17.0.1",
    "192.168.5.2",
    "169.254.169.254",
    "100.95.8.81",
    "0.0.0.0",
    "::1",
    "fd7a:115c:a1e0::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "104.16.1.1", "172.32.0.1", "100.128.0.1", "2606:4700::1"])(
    "allows %s",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );
});

describe("isBlockedUrl", () => {
  beforeEach(() => {
    lookup.mockReset();
  });

  it.each([
    "http://host.docker.internal:11434/api/pull",
    "http://localhost:3737/",
    "http://app.localhost/",
    "http://printer.local/",
    "https://box.tail1234.ts.net/",
    "http://172.17.0.1:2500/",
    "http://[::1]:11434/",
    "ws://100.95.8.81:2400/",
  ])("blocks %s without DNS", async (url) => {
    expect(await isBlockedUrl(url)).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("blocks a public name that resolves to a private address", async () => {
    lookup.mockResolvedValue([{ address: "192.168.1.10", family: 4 }]);
    expect(await isBlockedUrl("https://rebind.example.com/")).toBe(true);
  });

  it("allows a public name that resolves publicly", async () => {
    lookup.mockResolvedValue([{ address: "104.18.0.1", family: 4 }]);
    expect(await isBlockedUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe(false);
  });

  it("ignores non-network schemes and unresolvable names", async () => {
    expect(await isBlockedUrl("data:text/html,hi")).toBe(false);
    lookup.mockImplementation(async () => {
      throw new Error("ENOTFOUND");
    });
    expect(await isBlockedUrl("https://nope.invalid/")).toBe(false);
  });
});
