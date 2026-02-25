import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const getParticipantsSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
});

export async function getParticipants(args: z.infer<typeof getParticipantsSchema>) {
  const { sessionId } = args;

  logger.info("get_participants tool called", { sessionId });

  const session = sessionManager.getSession(sessionId);
  const participants = await session.meetPage.getParticipants();

  return {
    sessionId,
    participantCount: participants.length,
    participants,
  };
}
