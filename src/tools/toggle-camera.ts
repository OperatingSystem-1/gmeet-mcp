import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const toggleCameraSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
});

export async function toggleCamera(args: z.infer<typeof toggleCameraSchema>) {
  const { sessionId } = args;

  logger.info("toggle_camera tool called", { sessionId });

  const session = sessionManager.getSession(sessionId);
  const state = await session.meetPage.toggleCamera();

  return {
    sessionId,
    cameraState: state,
  };
}
