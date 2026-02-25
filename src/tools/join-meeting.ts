import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const joinMeetingSchema = z.object({
  meetUrl: z.string().url().describe("Google Meet URL to join (e.g. https://meet.google.com/abc-defg-hij)"),
});

export async function joinMeeting(args: z.infer<typeof joinMeetingSchema>) {
  const { meetUrl } = args;

  if (!meetUrl.includes("meet.google.com")) {
    return { error: "URL must be a Google Meet link (meet.google.com)" };
  }

  logger.info("join_meeting tool called", { meetUrl });

  const session = await sessionManager.createSession(meetUrl);

  try {
    await session.meetPage.joinMeeting(meetUrl);
    session.markActive();

    return {
      sessionId: session.state.id,
      status: "joined",
      meetUrl,
      joinedAt: session.state.joinedAt,
    };
  } catch (err) {
    // Clean up on failure
    await sessionManager.closeSession(session.state.id).catch(() => {});
    throw err;
  }
}
