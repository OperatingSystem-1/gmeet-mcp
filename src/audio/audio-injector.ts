import type { Page } from "playwright-core";
import { playAudioInPage } from "./stream-injector.js";
import { logger } from "../utils/logger.js";

/**
 * Plays audio into a Google Meet call via the Web Audio API bridge.
 *
 * Audio is sent as base64 WAV to the page, decoded by the browser's
 * Web Audio API, and played through a MediaStreamDestination that
 * feeds the WebRTC peer connection — so all participants hear it.
 */
export class AudioInjector {
  private page: Page | null = null;
  private isPlaying = false;
  private queue: Array<{ wavData: Buffer; resolve: (duration: number) => void; reject: (err: Error) => void }> = [];

  setPage(page: Page) {
    this.page = page;
  }

  async injectAudio(wavData: Buffer): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.queue.push({ wavData, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) return;
    if (!this.page) {
      const item = this.queue.shift();
      item?.reject(new Error("No page set on AudioInjector"));
      return;
    }

    this.isPlaying = true;
    const { wavData, resolve, reject } = this.queue.shift()!;

    try {
      logger.info("Injecting audio via Web Audio API", { bytes: wavData.length });
      const duration = await playAudioInPage(this.page, wavData);
      logger.info("Audio playback complete", { durationSeconds: duration.toFixed(2) });
      resolve(duration);
    } catch (err) {
      logger.error("Audio injection failed", { error: String(err) });
      reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.isPlaying = false;
      this.processQueue();
    }
  }

  cleanup(): void {
    this.page = null;
    this.queue = [];
  }
}
