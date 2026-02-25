import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { logger } from "../utils/logger.js";

export const takeScreenshotSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
});

export async function takeScreenshot(args: z.infer<typeof takeScreenshotSchema>) {
  const { sessionId } = args;

  logger.info("take_screenshot tool called", { sessionId });

  const session = sessionManager.getSession(sessionId);
  const buffer = await session.meetPage.takeScreenshot();

  return {
    sessionId,
    screenshot: buffer.toString("base64"),
    format: "png",
    size: buffer.length,
  };
}
