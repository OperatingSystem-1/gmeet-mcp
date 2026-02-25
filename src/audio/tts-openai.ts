import OpenAI from "openai";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { AudioError } from "../utils/errors.js";
import type { TTSEngine } from "./tts-engine.js";

export class OpenAITTS implements TTSEngine {
  private client: OpenAI;

  constructor() {
    const config = getConfig();
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
  }

  async synthesize(text: string, voice?: string): Promise<Buffer> {
    const config = getConfig();

    logger.info("Generating TTS audio", { textLength: text.length, voice: voice ?? config.ttsVoice });

    try {
      const response = await this.client.audio.speech.create({
        model: config.ttsModel,
        voice: (voice ?? config.ttsVoice) as any,
        input: text,
        response_format: "wav",
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      throw new AudioError(
        `TTS synthesis failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
