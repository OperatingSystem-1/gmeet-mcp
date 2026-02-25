import type { BrowserContext } from "playwright-core";
import type { MeetPage } from "../browser/meet-page.js";
import type { AudioInjector } from "../audio/audio-injector.js";

export interface SessionState {
  id: string;
  meetUrl: string;
  status: "joining" | "active" | "leaving" | "ended";
  joinedAt: string;
  endedAt?: string;
}

export class Session {
  public state: SessionState;
  public context: BrowserContext;
  public meetPage: MeetPage;
  public audioInjector: AudioInjector | null = null;

  constructor(
    id: string,
    meetUrl: string,
    context: BrowserContext,
    meetPage: MeetPage,
  ) {
    this.state = {
      id,
      meetUrl,
      status: "joining",
      joinedAt: new Date().toISOString(),
    };
    this.context = context;
    this.meetPage = meetPage;
  }

  markActive() {
    this.state.status = "active";
  }

  markLeaving() {
    this.state.status = "leaving";
  }

  markEnded() {
    this.state.status = "ended";
    this.state.endedAt = new Date().toISOString();
  }
}
