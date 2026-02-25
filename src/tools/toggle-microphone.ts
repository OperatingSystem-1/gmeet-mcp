import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const toggleMicrophoneSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
});

export async function toggleMicrophone(args: z.infer<typeof toggleMicrophoneSchema>) {
  const { sessionId } = args;

  logger.info("toggle_microphone tool called", { sessionId });

  const session = sessionManager.getSession(sessionId);
  const state = await session.meetPage.toggleMicrophone();

  return {
    sessionId,
    microphoneState: state,
  };
}
