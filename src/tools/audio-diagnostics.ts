import { z } from "zod";
import { sessionManager } from "../session/session-manager.js";
import { getAudioDiagnostics } from "../audio/stream-injector.js";
import { logger } from "../utils/logger.js";

export const audioDiagnosticsSchema = z.object({
  sessionId: z.string().describe("Session ID returned by join_meeting"),
});

export async function audioDiagnostics(args: z.infer<typeof audioDiagnosticsSchema>) {
  const { sessionId } = args;

  const session = sessionManager.getSession(sessionId);
  const page = session.meetPage.getPage();

  const diag = await getAudioDiagnostics(page);

  if (!diag) {
    return { error: "Could not retrieve audio diagnostics — audio may not be initialized" };
  }

  logger.info("Audio diagnostics", diag);

  return {
    sessionId,
    ...diag,
  };
}
