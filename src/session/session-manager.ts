import { randomUUID } from "node:crypto";
import { Session } from "./session.js";
import { MeetPage } from "../browser/meet-page.js";
import { browserManager } from "../browser/browser-manager.js";
import { AudioInjector } from "../audio/audio-injector.js";
import { logger } from "../utils/logger.js";
import { SessionError } from "../utils/errors.js";

export class SessionManager {
  private sessions = new Map<string, Session>();

  async createSession(meetUrl: string): Promise<Session> {
    const id = randomUUID().slice(0, 8);

    logger.info("Creating session", { id, meetUrl });

    const context = await browserManager.launchPersistentContext({
      headed: false,
    });

    const page = context.pages()[0] || (await context.newPage());

    // Grant permissions
    await context.grantPermissions(["microphone", "camera"], {
      origin: "https://meet.google.com",
    });

    const meetPage = new MeetPage(page);

    // AudioInjector now works via the page's Web Audio API
    const audioInjector = new AudioInjector();
    audioInjector.setPage(page);

    const session = new Session(id, meetUrl, context, meetPage);
    session.audioInjector = audioInjector;

    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`);
    }
    return session;
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  async closeSession(id: string): Promise<void> {
    const session = this.getSession(id);

    session.markLeaving();

    try {
      await session.meetPage.leaveMeeting();
    } catch (err) {
      logger.warn("Error leaving meeting", { sessionId: id, error: String(err) });
    }

    try {
      await session.context.close();
    } catch (err) {
      logger.warn("Error closing browser context", { sessionId: id, error: String(err) });
    }

    if (session.audioInjector) {
      session.audioInjector.cleanup();
    }

    session.markEnded();
    this.sessions.delete(id);

    logger.info("Session closed", { id });
  }

  async closeAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    for (const id of ids) {
      try {
        await this.closeSession(id);
      } catch (err) {
        logger.error("Error closing session", { id, error: String(err) });
      }
    }
  }
}

export const sessionManager = new SessionManager();

// Cleanup on process exit
function cleanup() {
  logger.info("Process exit — cleaning up sessions");
  sessionManager.closeAll().catch(() => {});
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
