import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { BrowserError } from "../utils/errors.js";

const CHROME_FLAGS = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--disable-blink-features=AutomationControlled",
  "--disable-features=WebRtcHideLocalIpsWithMdns",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-infobars",
  "--autoplay-policy=no-user-gesture-required",
];

export class BrowserManager {
  private browser: Browser | null = null;

  async launchPersistentContext(options?: {
    headed?: boolean;
    fakeAudioPath?: string;
  }): Promise<BrowserContext> {
    const config = getConfig();
    const userDataDir = config.chromeUserDataDir;

    if (!existsSync(userDataDir)) {
      mkdirSync(userDataDir, { recursive: true });
    }

    const args = [...CHROME_FLAGS];

    if (options?.fakeAudioPath) {
      args.push(`--use-file-for-fake-audio-capture=${options.fakeAudioPath}`);
    }

    logger.info("Launching persistent browser context", {
      userDataDir,
      headed: options?.headed ?? false,
    });

    try {
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: !(options?.headed ?? false),
        executablePath: config.chromeExecutablePath || undefined,
        args,
        ignoreDefaultArgs: ["--enable-automation"],
        permissions: ["microphone", "camera", "notifications"],
        bypassCSP: true,
        viewport: { width: 1280, height: 720 },
      });

      return context;
    } catch (err) {
      throw new BrowserError(`Failed to launch browser: ${err instanceof Error ? err.message : err}`);
    }
  }

  async launch(options?: {
    headed?: boolean;
    fakeAudioPath?: string;
  }): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;

    const config = getConfig();
    const args = [...CHROME_FLAGS];

    if (options?.fakeAudioPath) {
      args.push(`--use-file-for-fake-audio-capture=${options.fakeAudioPath}`);
    }

    logger.info("Launching browser", { headed: options?.headed ?? false });

    try {
      this.browser = await chromium.launch({
        headless: !(options?.headed ?? false),
        executablePath: config.chromeExecutablePath || undefined,
        args,
        ignoreDefaultArgs: ["--enable-automation"],
      });

      return this.browser;
    } catch (err) {
      throw new BrowserError(`Failed to launch browser: ${err instanceof Error ? err.message : err}`);
    }
  }

  async createPage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();

    // Grant permissions for media
    await context.grantPermissions(["microphone", "camera"], {
      origin: "https://meet.google.com",
    });

    return page;
  }

  async closeAll() {
    if (this.browser?.isConnected()) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info("All browsers closed");
  }
}

export const browserManager = new BrowserManager();
