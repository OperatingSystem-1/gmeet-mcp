import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const leaveMeetingSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
});

export async function leaveMeeting(args: z.infer<typeof leaveMeetingSchema>) {
  const { sessionId } = args;

  logger.info("leave_meeting tool called", { sessionId });

  await sessionManager.closeSession(sessionId);

  return {
    sessionId,
    status: "left",
    leftAt: new Date().toISOString(),
  };
}
