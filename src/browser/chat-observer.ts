import type { Page } from "playwright-core";
import { logger } from "../utils/logger.js";

export interface ChatMessage {
  sender: string;
  text: string;
  timestamp: string;
}

/**
 * Injects a MutationObserver that watches the Meet chat panel for new messages.
 */
export async function injectChatObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__gmeet_chat_messages = [] as Array<{
      sender: string;
      text: string;
      timestamp: string;
    }>;

    const seenTexts = new Set<string>();

    const observer = new MutationObserver(() => {
      const messages = document.querySelectorAll(
        '[data-message-text], [data-sender-id], [class*="chat"] [class*="message"]',
      );

      messages.forEach((msg) => {
        const text =
          msg.getAttribute("data-message-text") || msg.querySelector('[class*="text"]')?.textContent?.trim() || "";
        const sender =
          msg.querySelector('[class*="sender"], [class*="name"]')?.textContent?.trim() || "Unknown";

        const key = `${sender}:${text}`;
        if (text && !seenTexts.has(key)) {
          seenTexts.add(key);
          (window as any).__gmeet_chat_messages.push({
            sender,
            text,
            timestamp: new Date().toISOString(),
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    (window as any).__gmeet_chat_observer = observer;
  });

  logger.info("Chat observer injected");
}

export async function getChatBuffer(page: Page): Promise<ChatMessage[]> {
  return await page.evaluate(() => {
    return (window as any).__gmeet_chat_messages || [];
  });
}
