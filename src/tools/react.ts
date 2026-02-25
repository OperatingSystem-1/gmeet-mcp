import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const reactSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
  emoji: z.string().describe("Emoji reaction to send (e.g. thumbs up, heart, clap, laugh, surprised)"),
});

const EMOJI_MAP: Record<string, string> = {
  "thumbs up": "\u{1F44D}",
  "thumbsup": "\u{1F44D}",
  "heart": "\u2764\uFE0F",
  "clap": "\u{1F44F}",
  "laugh": "\u{1F602}",
  "surprised": "\u{1F62E}",
  "thinking": "\u{1F914}",
};

export async function react(args: z.infer<typeof reactSchema>) {
  const { sessionId, emoji } = args;

  logger.info("react tool called", { sessionId, emoji });

  const session = sessionManager.getSession(sessionId);

  // Resolve emoji name to actual emoji if needed
  const resolvedEmoji = EMOJI_MAP[emoji.toLowerCase()] || emoji;

  await session.meetPage.sendReaction(resolvedEmoji);

  return {
    sessionId,
    status: "reaction_sent",
    emoji: resolvedEmoji,
  };
}
