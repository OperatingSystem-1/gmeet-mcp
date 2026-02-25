import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { joinMeetingSchema, joinMeeting } from "./tools/join-meeting.js";
import { leaveMeetingSchema, leaveMeeting } from "./tools/leave-meeting.js";
import { speakSchema, speak } from "./tools/speak.js";
import { getTranscriptSchema, getTranscript } from "./tools/get-transcript.js";
import { sendChatMessageSchema, sendChatMessage } from "./tools/send-chat-message.js";
import { getChatMessagesSchema, getChatMessages } from "./tools/get-chat-messages.js";
import { getParticipantsSchema, getParticipants } from "./tools/get-participants.js";
import { getMeetingStatusSchema, getMeetingStatus } from "./tools/get-meeting-status.js";
import { toggleMicrophoneSchema, toggleMicrophone } from "./tools/toggle-microphone.js";
import { toggleCameraSchema, toggleCamera } from "./tools/toggle-camera.js";
import { raiseHandSchema, raiseHand } from "./tools/raise-hand.js";
import { reactSchema, react } from "./tools/react.js";
import { authenticate } from "./tools/authenticate.js";
import { takeScreenshotSchema, takeScreenshot } from "./tools/take-screenshot.js";
import { audioDiagnosticsSchema, audioDiagnostics } from "./tools/audio-diagnostics.js";
import { logger } from "./utils/logger.js";

function wrapHandler<T>(fn: (args: T) => Promise<any>) {
  return async (args: T) => {
    try {
      const result = await fn(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Tool error", { error: message });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  };
}

export function registerTools(server: McpServer) {
  server.tool(
    "join_meeting",
    "Join a Google Meet call by URL. Returns a sessionId for use with other tools.",
    joinMeetingSchema.shape,
    wrapHandler(joinMeeting),
  );

  server.tool(
    "leave_meeting",
    "Leave a Google Meet call and clean up the session.",
    leaveMeetingSchema.shape,
    wrapHandler(leaveMeeting),
  );

  server.tool(
    "speak",
    "Speak text aloud in the meeting using TTS. Other participants will hear it.",
    speakSchema.shape,
    wrapHandler(speak),
  );

  server.tool(
    "get_transcript",
    "Get the running transcript of what participants have said (via captions).",
    getTranscriptSchema.shape,
    wrapHandler(getTranscript),
  );

  server.tool(
    "send_chat_message",
    "Send a text message in the meeting chat.",
    sendChatMessageSchema.shape,
    wrapHandler(sendChatMessage),
  );

  server.tool(
    "get_chat_messages",
    "Read all chat messages from the meeting.",
    getChatMessagesSchema.shape,
    wrapHandler(getChatMessages),
  );

  server.tool(
    "get_participants",
    "List all current participants in the meeting.",
    getParticipantsSchema.shape,
    wrapHandler(getParticipants),
  );

  server.tool(
    "get_meeting_status",
    "Get meeting status including duration, mute state, and connection info.",
    getMeetingStatusSchema.shape,
    wrapHandler(getMeetingStatus),
  );

  server.tool(
    "toggle_microphone",
    "Mute or unmute the microphone in the meeting.",
    toggleMicrophoneSchema.shape,
    wrapHandler(toggleMicrophone),
  );

  server.tool(
    "toggle_camera",
    "Enable or disable the camera in the meeting.",
    toggleCameraSchema.shape,
    wrapHandler(toggleCamera),
  );

  server.tool(
    "raise_hand",
    "Raise hand in the meeting.",
    raiseHandSchema.shape,
    wrapHandler(raiseHand),
  );

  server.tool(
    "react",
    "Send an emoji reaction in the meeting (e.g. thumbs up, heart, clap).",
    reactSchema.shape,
    wrapHandler(react),
  );

  server.tool(
    "authenticate",
    "Open a headed browser for Google account login. Required before joining meetings.",
    {},
    wrapHandler(authenticate),
  );

  server.tool(
    "take_screenshot",
    "Take a screenshot of the current meeting view. Returns base64-encoded PNG.",
    takeScreenshotSchema.shape,
    wrapHandler(takeScreenshot),
  );

  server.tool(
    "audio_diagnostics",
    "Get detailed audio pipeline diagnostics for a meeting session — useful for debugging TTS/speak issues.",
    audioDiagnosticsSchema.shape,
    wrapHandler(audioDiagnostics),
  );

  logger.info("All tools registered", { count: 15 });
}
