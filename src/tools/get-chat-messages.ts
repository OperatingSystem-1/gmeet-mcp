import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const getChatMessagesSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
});

export async function getChatMessages(args: z.infer<typeof getChatMessagesSchema>) {
  const { sessionId } = args;

  logger.info("get_chat_messages tool called", { sessionId });

  const session = sessionManager.getSession(sessionId);
  const messages = await session.meetPage.getChatMessages();

  return {
    sessionId,
    messageCount: messages.length,
    messages,
  };
}
