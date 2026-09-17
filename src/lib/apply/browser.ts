import { chromium, type Browser } from "playwright-core";

// One shared headless Chromium instance for the whole process, lazily
// launched on first use — mirrors the Prisma singleton in db.ts so route
// bundle separation in Next.js can't spawn a second browser process.
declare const globalThis: {
  applyBrowserGlobal?: Promise<Browser>;
} & typeof global;

function launch(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  });
}

export function getBrowser(): Promise<Browser> {
  if (!globalThis.applyBrowserGlobal) {
    globalThis.applyBrowserGlobal = launch();
  }
  return globalThis.applyBrowserGlobal;
}
