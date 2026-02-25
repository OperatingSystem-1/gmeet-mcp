import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const getTranscriptSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
  limit: z.number().optional().describe("Max number of entries to return (default: all)"),
});

export async function getTranscript(args: z.infer<typeof getTranscriptSchema>) {
  const { sessionId, limit } = args;

  logger.info("get_transcript tool called", { sessionId });

  const session = sessionManager.getSession(sessionId);
  let entries = await session.meetPage.getTranscript();

  if (limit && limit > 0) {
    entries = entries.slice(-limit);
  }

  return {
    sessionId,
    entryCount: entries.length,
    entries,
  };
}
