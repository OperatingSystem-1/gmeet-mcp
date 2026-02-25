import OpenAI, { toFile } from "openai";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { AudioError } from "../utils/errors.js";

export interface TranscriptionResult {
  text: string;
  timestamp: string;
}

export class Transcriber {
  private client: OpenAI;

  constructor() {
    const config = getConfig();
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
  }

  async transcribe(audioBuffer: Buffer, format: string = "webm"): Promise<TranscriptionResult> {
    const config = getConfig();

    logger.info("Transcribing audio", { bufferSize: audioBuffer.length, format });

    try {
      const file = await toFile(audioBuffer, `audio.${format}`, {
        type: `audio/${format}`,
      });

      const transcription = await this.client.audio.transcriptions.create({
        model: config.whisperModel,
        file,
      });

      return {
        text: transcription.text,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      throw new AudioError(
        `Transcription failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
