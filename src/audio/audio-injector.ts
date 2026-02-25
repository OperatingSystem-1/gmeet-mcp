import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createSilentWav, estimateDuration } from "./wav-utils.js";
import { logger } from "../utils/logger.js";

/**
 * Manages the WAV file that Chrome reads via --use-file-for-fake-audio-capture.
 *
 * Chrome continuously reads this file in a loop. To "speak", we overwrite it
 * with TTS audio, wait for the duration, then overwrite with silence again.
 */
export class AudioInjector {
  private filePath: string;
  private isPlaying = false;
  private queue: Array<{ wavData: Buffer; resolve: () => void }> = [];

  constructor() {
    const dir = join(tmpdir(), "gmeet-mcp");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.filePath = join(dir, `audio-${randomUUID().slice(0, 8)}.wav`);
  }

  getFilePath(): string {
    return this.filePath;
  }

  async writeSilence(durationSeconds: number = 1): Promise<void> {
    const wav = createSilentWav(durationSeconds);
    writeFileSync(this.filePath, wav);
  }

  async injectAudio(wavData: Buffer): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push({ wavData, resolve });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) return;

    this.isPlaying = true;
    const { wavData, resolve } = this.queue.shift()!;

    try {
      const duration = estimateDuration(wavData);
      logger.info("Injecting audio", { durationSeconds: duration.toFixed(2) });

      // Write the TTS audio
      writeFileSync(this.filePath, wavData);

      // Wait for Chrome to play through the audio
      // Add a small buffer for Chrome's read cycle
      await new Promise((r) => setTimeout(r, (duration + 0.5) * 1000));

      // Restore silence
      await this.writeSilence(1);
    } catch (err) {
      logger.error("Audio injection failed", { error: String(err) });
    } finally {
      this.isPlaying = false;
      resolve();
      // Process next in queue
      this.processQueue();
    }
  }

  cleanup(): void {
    try {
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath);
      }
    } catch {
      // Best effort
    }
  }
}
