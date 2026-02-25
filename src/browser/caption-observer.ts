import type { Page } from "playwright-core";
import { logger } from "../utils/logger.js";

export interface CaptionEntry {
  speaker: string;
  text: string;
  timestamp: string;
}

/**
 * Injects a MutationObserver into the page that watches for caption updates.
 * Captions are buffered in window.__gmeet_captions.
 */
export async function injectCaptionObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__gmeet_captions = [] as Array<{
      speaker: string;
      text: string;
      timestamp: string;
    }>;

    let currentSpeaker = "";
    let lastText = "";

    const observer = new MutationObserver(() => {
      // Google Meet caption containers
      const captionContainers = document.querySelectorAll(
        '[jsname="dsyhDe"], .a4cQT, [class*="caption"]',
      );

      captionContainers.forEach((container) => {
        const speakerEl = container.querySelector('[jsname="bN97Pc"], .zs7s8d, [class*="speaker"]');
        const textEl = container.querySelector('[jsname="YSxPC"], .bh44bd, [class*="text"]');

        const speaker = speakerEl?.textContent?.trim() || currentSpeaker || "Unknown";
        const text = textEl?.textContent?.trim() || "";

        if (text && text !== lastText) {
          currentSpeaker = speaker;
          lastText = text;

          (window as any).__gmeet_captions.push({
            speaker,
            text,
            timestamp: new Date().toISOString(),
          });

          // Keep buffer to last 500 entries
          if ((window as any).__gmeet_captions.length > 500) {
            (window as any).__gmeet_captions.shift();
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    (window as any).__gmeet_caption_observer = observer;
  });

  logger.info("Caption observer injected");
}

export async function getCaptionBuffer(page: Page): Promise<CaptionEntry[]> {
  return await page.evaluate(() => {
    return (window as any).__gmeet_captions || [];
  });
}

export async function clearCaptionBuffer(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__gmeet_captions = [];
  });
}
