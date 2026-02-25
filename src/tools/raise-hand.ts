import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const raiseHandSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
});

export async function raiseHand(args: z.infer<typeof raiseHandSchema>) {
  const { sessionId } = args;

  logger.info("raise_hand tool called", { sessionId });

  const session = sessionManager.getSession(sessionId);
  await session.meetPage.raiseHand();

  return {
    sessionId,
    status: "hand_raised",
  };
}
