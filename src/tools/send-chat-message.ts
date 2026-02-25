import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const sendChatMessageSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
  message: z.string().min(1).describe("Chat message to send"),
});

export async function sendChatMessage(args: z.infer<typeof sendChatMessageSchema>) {
  const { sessionId, message } = args;

  logger.info("send_chat_message tool called", { sessionId, messageLength: message.length });

  const session = sessionManager.getSession(sessionId);
  await session.meetPage.sendChatMessage(message);

  return {
    sessionId,
    status: "sent",
    messageLength: message.length,
  };
}
