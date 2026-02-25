import type { Page } from "playwright-core";
import { SELECTORS } from "./meet-selectors.js";
import { injectCaptionObserver, getCaptionBuffer, type CaptionEntry } from "./caption-observer.js";
import { injectChatObserver, getChatBuffer, type ChatMessage } from "./chat-observer.js";
import { takeOverAudioTrack } from "../audio/stream-injector.js";
import { logger } from "../utils/logger.js";
import { MeetError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";

export interface Participant {
  name: string;
}

export class MeetPage {
  constructor(private page: Page) {}

  getPage(): Page {
    return this.page;
  }

  async joinMeeting(meetUrl: string): Promise<void> {
    logger.info("Navigating to meeting", { url: meetUrl });
    await this.page.goto(meetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Dismiss any "Got it" or info dialogs
    await this.dismissDialogs();

    // Wait for the pre-join screen or the in-meeting UI
    await this.page.waitForTimeout(3000);

    // Try to turn off mic and camera on pre-join screen
    await this.turnOffPreJoinMedia();

    // Click join button
    await retry(
      async () => {
        const joined = await this.clickJoinButton();
        if (!joined) throw new MeetError("Could not find join button");
      },
      { maxAttempts: 5, delayMs: 2000 },
    );

    // Wait for meeting to load
    await this.page.waitForTimeout(5000);

    // Dismiss any post-join dialogs
    await this.dismissDialogs();

    // Enable captions
    await this.enableCaptions();

    // Inject observers
    await injectCaptionObserver(this.page);
    await injectChatObserver(this.page);

    // Take over the audio track on the WebRTC connection
    // so we can stream TTS audio to all participants.
    // Retry a few times since WebRTC connections may take a moment to establish.
    let audioTakeoverSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await takeOverAudioTrack(this.page);
        logger.info("Audio track takeover successful", { attempt });
        audioTakeoverSuccess = true;
        break;
      } catch (err) {
        logger.warn(`Audio track takeover attempt ${attempt}/3 failed`, {
          error: String(err),
        });
        if (attempt < 3) {
          await this.page.waitForTimeout(3000);
        }
      }
    }

    if (!audioTakeoverSuccess) {
      logger.error("All audio track takeover attempts failed — TTS speak will not work");
    }

    logger.info("Successfully joined meeting");
  }

  private async dismissDialogs(): Promise<void> {
    for (const selector of [SELECTORS.GOT_IT_BUTTON, SELECTORS.DISMISS_BUTTON]) {
      try {
        const el = this.page.locator(selector).first();
        if (await el.isVisible({ timeout: 1000 })) {
          await el.click();
          await this.page.waitForTimeout(500);
        }
      } catch {
        // Dialog not present, that's fine
      }
    }
  }

  private async turnOffPreJoinMedia(): Promise<void> {
    try {
      // Try to mute mic if not already muted
      const micButton = this.page.locator(SELECTORS.MIC_BUTTON).first();
      if (await micButton.isVisible({ timeout: 2000 })) {
        const ariaLabel = await micButton.getAttribute("aria-label");
        if (ariaLabel && !ariaLabel.toLowerCase().includes("unmute")) {
          await micButton.click();
        }
      }
    } catch {
      // Pre-join controls might not be visible
    }

    try {
      const camButton = this.page.locator(SELECTORS.CAMERA_BUTTON).first();
      if (await camButton.isVisible({ timeout: 2000 })) {
        const ariaLabel = await camButton.getAttribute("aria-label");
        if (ariaLabel && !ariaLabel.toLowerCase().includes("turn on")) {
          await camButton.click();
        }
      }
    } catch {
      // Pre-join controls might not be visible
    }
  }

  private async clickJoinButton(): Promise<boolean> {
    // Try multiple selectors for the join button
    const selectors = [
      SELECTORS.JOIN_BUTTON,
      SELECTORS.JOIN_BUTTON_ALT,
      SELECTORS.ASK_TO_JOIN_BUTTON,
      'button:has-text("Join now")',
      'button:has-text("Ask to join")',
      'button:has-text("Join")',
    ];

    for (const sel of selectors) {
      try {
        const el = this.page.locator(sel).first();
        if (await el.isVisible({ timeout: 1500 })) {
          await el.click();
          logger.info("Clicked join button", { selector: sel });
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  async enableCaptions(): Promise<void> {
    try {
      const captionsBtn = this.page.locator(SELECTORS.CAPTIONS_BUTTON).first();
      if (await captionsBtn.isVisible({ timeout: 3000 })) {
        const ariaLabel = await captionsBtn.getAttribute("aria-label");
        // Only click if captions are currently off
        if (ariaLabel && ariaLabel.toLowerCase().includes("turn on")) {
          await captionsBtn.click();
          logger.info("Captions enabled");
        }
      }
    } catch {
      logger.warn("Could not enable captions");
    }
  }

  async leaveMeeting(): Promise<void> {
    try {
      const hangup = this.page.locator(SELECTORS.HANGUP_BUTTON).first();
      await hangup.click({ timeout: 5000 });
      logger.info("Left meeting");
    } catch {
      // Force close the page
      await this.page.close();
      logger.warn("Force-closed meeting page");
    }
  }

  async toggleMicrophone(): Promise<string> {
    const mic = this.page.locator(SELECTORS.MIC_BUTTON).first();
    await mic.click({ timeout: 5000 });
    const label = (await mic.getAttribute("aria-label")) || "";
    const isMuted = label.toLowerCase().includes("unmute") || label.toLowerCase().includes("turn on");
    return isMuted ? "muted" : "unmuted";
  }

  async toggleCamera(): Promise<string> {
    const cam = this.page.locator(SELECTORS.CAMERA_BUTTON).first();
    await cam.click({ timeout: 5000 });
    const label = (await cam.getAttribute("aria-label")) || "";
    const isOff = label.toLowerCase().includes("turn on");
    return isOff ? "camera_off" : "camera_on";
  }

  async raiseHand(): Promise<void> {
    // May need to open more options first
    try {
      const raiseBtn = this.page.locator(SELECTORS.RAISE_HAND_BUTTON).first();
      if (await raiseBtn.isVisible({ timeout: 2000 })) {
        await raiseBtn.click();
        return;
      }
    } catch {
      // Try via more options menu
    }

    try {
      const moreBtn = this.page.locator(SELECTORS.MORE_OPTIONS_BUTTON).first();
      await moreBtn.click({ timeout: 3000 });
      await this.page.waitForTimeout(500);

      const raiseBtn = this.page.locator(SELECTORS.RAISE_HAND_BUTTON).first();
      await raiseBtn.click({ timeout: 3000 });
    } catch {
      throw new MeetError("Could not find raise hand button");
    }
  }

  async sendReaction(emoji: string): Promise<void> {
    try {
      // Open reactions panel
      const reactionsBtn = this.page.locator(SELECTORS.REACTIONS_BUTTON).first();
      await reactionsBtn.click({ timeout: 3000 });
      await this.page.waitForTimeout(500);

      // Click the specific emoji
      const emojiBtn = this.page.locator(SELECTORS.REACTION_EMOJI(emoji)).first();
      await emojiBtn.click({ timeout: 3000 });
    } catch {
      throw new MeetError(`Could not send reaction: ${emoji}`);
    }
  }

  async sendChatMessage(message: string): Promise<void> {
    // Open chat panel
    try {
      const chatBtn = this.page.locator(SELECTORS.CHAT_BUTTON).first();
      if (await chatBtn.isVisible({ timeout: 2000 })) {
        await chatBtn.click();
        await this.page.waitForTimeout(1000);
      }
    } catch {
      // Chat might already be open
    }

    // Type and send
    const input = this.page.locator(SELECTORS.CHAT_INPUT).first();
    await input.fill(message, { timeout: 5000 });

    // Try send button first, then Enter key
    try {
      const sendBtn = this.page.locator(SELECTORS.CHAT_SEND_BUTTON).first();
      if (await sendBtn.isVisible({ timeout: 1000 })) {
        await sendBtn.click();
        return;
      }
    } catch {
      // Fall through to Enter
    }

    await input.press("Enter");
  }

  async getChatMessages(): Promise<ChatMessage[]> {
    return getChatBuffer(this.page);
  }

  async getTranscript(): Promise<CaptionEntry[]> {
    return getCaptionBuffer(this.page);
  }

  async getParticipants(): Promise<Participant[]> {
    // Open participants panel
    try {
      const peopleBtn = this.page.locator(SELECTORS.PARTICIPANTS_BUTTON).first();
      if (await peopleBtn.isVisible({ timeout: 2000 })) {
        await peopleBtn.click();
        await this.page.waitForTimeout(1000);
      }
    } catch {
      // Panel might already be open
    }

    // Scrape participant names
    const names = await this.page.evaluate(() => {
      const items = document.querySelectorAll('[role="listitem"]');
      const result: string[] = [];
      items.forEach((item) => {
        const name = item.textContent?.trim();
        if (name) result.push(name);
      });
      return result;
    });

    return names.map((name) => ({ name }));
  }

  async getMeetingStatus(): Promise<{
    isInMeeting: boolean;
    meetingUrl: string;
    micState: string;
    cameraState: string;
  }> {
    const url = this.page.url();
    const isInMeeting = url.includes("meet.google.com") && !url.includes("accounts.google.com");

    let micState = "unknown";
    let cameraState = "unknown";

    try {
      const mic = this.page.locator(SELECTORS.MIC_BUTTON).first();
      if (await mic.isVisible({ timeout: 1000 })) {
        const label = (await mic.getAttribute("aria-label")) || "";
        micState = label.toLowerCase().includes("unmute") ? "muted" : "unmuted";
      }
    } catch {
      // Not in meeting
    }

    try {
      const cam = this.page.locator(SELECTORS.CAMERA_BUTTON).first();
      if (await cam.isVisible({ timeout: 1000 })) {
        const label = (await cam.getAttribute("aria-label")) || "";
        cameraState = label.toLowerCase().includes("turn on") ? "off" : "on";
      }
    } catch {
      // Not in meeting
    }

    return { isInMeeting, meetingUrl: url, micState, cameraState };
  }

  async takeScreenshot(): Promise<Buffer> {
    return await this.page.screenshot({ type: "png" });
  }
}
