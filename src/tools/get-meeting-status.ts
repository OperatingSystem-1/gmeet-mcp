import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const getMeetingStatusSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
});

export async function getMeetingStatus(args: z.infer<typeof getMeetingStatusSchema>) {
  const { sessionId } = args;

  logger.info("get_meeting_status tool called", { sessionId });

  const session = sessionManager.getSession(sessionId);
  const pageStatus = await session.meetPage.getMeetingStatus();

  return {
    sessionId,
    sessionStatus: session.state.status,
    joinedAt: session.state.joinedAt,
    ...pageStatus,
  };
}
