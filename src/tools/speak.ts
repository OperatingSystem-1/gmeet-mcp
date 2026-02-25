import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { OpenAITTS } from "../audio/tts-openai.js";
import { estimateDuration } from "../audio/wav-utils.js";
import { logger } from "../utils/logger.js";

export const speakSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
  text: z.string().min(1).describe("Text to speak aloud in the meeting"),
  voice: z.string().optional().describe("TTS voice to use (default: alloy)"),
});

const tts = new OpenAITTS();

export async function speak(args: z.infer<typeof speakSchema>) {
  const { sessionId, text, voice } = args;

  logger.info("speak tool called", { sessionId, textLength: text.length });

  const session = sessionManager.getSession(sessionId);

  if (!session.audioInjector) {
    return { error: "Audio injector not available for this session" };
  }

  // Unmute mic before speaking
  try {
    const status = await session.meetPage.getMeetingStatus();
    if (status.micState === "muted") {
      await session.meetPage.toggleMicrophone();
    }
  } catch {
    // Continue even if unmute fails
  }

  // Generate TTS audio
  const wavBuffer = await tts.synthesize(text, voice);
  const duration = estimateDuration(wavBuffer);

  // Inject audio into the meeting
  await session.audioInjector.injectAudio(wavBuffer);

  return {
    sessionId,
    status: "spoken",
    textLength: text.length,
    durationSeconds: Number(duration.toFixed(2)),
  };
}
