import type { BrowserContext, Page } from "playwright-core";
import { logger } from "../utils/logger.js";
import { AuthError } from "../utils/errors.js";
import { browserManager } from "./browser-manager.js";

const GOOGLE_ACCOUNTS_URL = "https://accounts.google.com";
const GOOGLE_SIGNED_IN_INDICATOR = '[aria-label="Google Account"]';

export async function isGoogleLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto("https://meet.google.com", { waitUntil: "domcontentloaded", timeout: 15000 });

    // Check if we're redirected to sign-in
    const url = page.url();
    if (url.includes("accounts.google.com")) {
      return false;
    }

    // Check for signed-in indicator
    const signedIn = await page.locator(GOOGLE_SIGNED_IN_INDICATOR).count();
    return signedIn > 0;
  } catch {
    return false;
  }
}

export async function authenticateInteractive(): Promise<BrowserContext> {
  logger.info("Opening headed browser for Google authentication");

  const context = await browserManager.launchPersistentContext({ headed: true });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto(GOOGLE_ACCOUNTS_URL, { waitUntil: "domcontentloaded" });

  logger.info("Waiting for user to complete Google sign-in...");

  // Wait for the user to sign in — poll until we detect a signed-in state
  const maxWait = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      await page.goto("https://meet.google.com", { waitUntil: "domcontentloaded", timeout: 10000 });
      const url = page.url();

      if (!url.includes("accounts.google.com")) {
        const signedIn = await page.locator(GOOGLE_SIGNED_IN_INDICATOR).count();
        if (signedIn > 0) {
          logger.info("Google authentication successful");
          return context;
        }
      }
    } catch {
      // Navigation might fail during sign-in flow, that's fine
    }

    await page.waitForTimeout(3000);
  }

  throw new AuthError("Authentication timed out after 5 minutes");
}
