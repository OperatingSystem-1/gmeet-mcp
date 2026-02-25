export class GmeetError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GmeetError";
  }
}

export class BrowserError extends GmeetError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "BROWSER_ERROR", details);
    this.name = "BrowserError";
  }
}

export class AuthError extends GmeetError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTH_ERROR", details);
    this.name = "AuthError";
  }
}

export class SessionError extends GmeetError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SESSION_ERROR", details);
    this.name = "SessionError";
  }
}

export class AudioError extends GmeetError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUDIO_ERROR", details);
    this.name = "AudioError";
  }
}

export class MeetError extends GmeetError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "MEET_ERROR", details);
    this.name = "MeetError";
  }
}
