import type { Page } from "playwright-core";
import { logger } from "../utils/logger.js";

/**
 * Captures audio from the Meet tab using Web Audio API.
 *
 * This injects a script that uses an AudioContext to capture the tab's audio
 * output and sends chunks back to Node via page.exposeFunction().
 *
 * Note: Full tab audio capture via chrome.tabCapture requires a Chrome extension.
 * This implementation uses the Web Audio API approach which captures audio
 * elements on the page.
 */
export class AudioCapture {
  private chunks: Buffer[] = [];
  private isCapturing = false;

  async startCapture(page: Page): Promise<void> {
    if (this.isCapturing) return;

    // Expose a function for the page to send audio data back to Node
    await page.exposeFunction("__gmeetSendAudioChunk", (base64Data: string) => {
      const buffer = Buffer.from(base64Data, "base64");
      this.chunks.push(buffer);
    });

    await page.evaluate(() => {
      const audioElements = document.querySelectorAll("audio, video");
      if (audioElements.length === 0) {
        console.warn("No audio/video elements found for capture");
        return;
      }

      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      audioElements.forEach((el) => {
        try {
          const source = audioContext.createMediaElementSource(el as HTMLMediaElement);
          source.connect(destination);
          source.connect(audioContext.destination); // Keep playing
        } catch {
          // Element might already be connected
        }
      });

      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            if (base64) {
              (window as any).__gmeetSendAudioChunk(base64);
            }
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorder.start(5000); // 5-second chunks
      (window as any).__gmeetMediaRecorder = mediaRecorder;
      (window as any).__gmeetAudioContext = audioContext;
    });

    this.isCapturing = true;
    logger.info("Audio capture started");
  }

  async stopCapture(page: Page): Promise<void> {
    if (!this.isCapturing) return;

    await page.evaluate(() => {
      const recorder = (window as any).__gmeetMediaRecorder;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      const ctx = (window as any).__gmeetAudioContext;
      if (ctx) ctx.close();
    });

    this.isCapturing = false;
    logger.info("Audio capture stopped");
  }

  getChunks(): Buffer[] {
    return this.chunks;
  }

  getAndClearChunks(): Buffer[] {
    const chunks = [...this.chunks];
    this.chunks = [];
    return chunks;
  }

  clearChunks(): void {
    this.chunks = [];
  }
}
