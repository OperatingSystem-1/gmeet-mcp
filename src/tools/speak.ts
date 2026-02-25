import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { OpenAITTS } from "../audio/tts-openai.js";
import { getAudioDiagnostics } from "../audio/stream-injector.js";
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

  // Log audio diagnostics before speaking
  try {
    const diag = await getAudioDiagnostics(session.meetPage.getPage());
    logger.info("Audio diagnostics before speak", diag as Record<string, unknown>);
  } catch {
    logger.warn("Could not get audio diagnostics");
  }

  // Unmute mic before speaking
  try {
    const status = await session.meetPage.getMeetingStatus();
    if (status.micState === "muted") {
      await session.meetPage.toggleMicrophone();
      // Wait for unmute to propagate
      await session.meetPage.getPage().waitForTimeout(500);
    }
  } catch {
    // Continue even if unmute fails
  }

  // Generate TTS audio
  const wavBuffer = await tts.synthesize(text, voice);
  logger.info("TTS audio generated", { bytes: wavBuffer.length });

  // Play audio through the Web Audio API bridge → WebRTC → participants
  const duration = await session.audioInjector.injectAudio(wavBuffer);

  // Log audio diagnostics after speaking
  try {
    const diag = await getAudioDiagnostics(session.meetPage.getPage());
    logger.info("Audio diagnostics after speak", diag as Record<string, unknown>);
  } catch {
    // ignore
  }

  return {
    sessionId,
    status: "spoken",
    textLength: text.length,
    durationSeconds: Number(duration.toFixed(2)),
  };
}
