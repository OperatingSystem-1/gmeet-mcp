/**
 * Centralized CSS/aria selectors for Google Meet DOM elements.
 * Google Meet updates its UI frequently — keep all selectors here for easy maintenance.
 */
export const SELECTORS = {
  // Pre-join screen
  PRE_JOIN_NAME_INPUT: 'input[aria-label="Your name"]',
  PRE_JOIN_MIC_OFF: '[data-is-muted="true"][aria-label*="microphone"]',
  PRE_JOIN_CAM_OFF: '[data-is-muted="true"][aria-label*="camera"]',
  JOIN_BUTTON: 'button[jsname="Qx7uuf"]',
  JOIN_BUTTON_ALT: 'button[data-idom-class*="join"]',
  ASK_TO_JOIN_BUTTON: 'button[jsname="Qx7uuf"]',
  GOT_IT_BUTTON: 'button:has-text("Got it")',
  DISMISS_BUTTON: 'button:has-text("Dismiss")',

  // In-meeting controls (bottom bar)
  MIC_BUTTON: '[aria-label*="microphone"][role="button"], button[aria-label*="microphone"]',
  CAMERA_BUTTON: '[aria-label*="camera"][role="button"], button[aria-label*="camera"]',
  HANGUP_BUTTON: '[aria-label="Leave call"], button[jsname="CQylAd"]',
  RAISE_HAND_BUTTON: '[aria-label*="Raise hand"], [aria-label*="raise hand"]',
  REACTIONS_BUTTON: '[aria-label*="reactions" i], [aria-label*="Reactions"]',
  CAPTIONS_BUTTON: '[aria-label*="captions" i], [aria-label*="Captions"]',
  MORE_OPTIONS_BUTTON: '[aria-label="More options"]',

  // Chat
  CHAT_BUTTON: '[aria-label*="chat" i][role="button"], button[aria-label*="Chat"]',
  CHAT_INPUT: 'textarea[aria-label*="Send a message"]',
  CHAT_SEND_BUTTON: 'button[aria-label="Send a message"], button[aria-label="Send"]',
  CHAT_MESSAGES_CONTAINER: '[data-is-persistent="true"], [aria-live="polite"]',
  CHAT_MESSAGE: '[data-message-text], [data-sender-id]',

  // Participants
  PARTICIPANTS_BUTTON: '[aria-label*="participant" i][role="button"], button[aria-label*="People"]',
  PARTICIPANTS_LIST: '[role="list"][aria-label*="Participant"], [aria-label*="People"]',
  PARTICIPANT_ITEM: '[role="listitem"]',
  PARTICIPANT_NAME: '[data-participant-id] span, [data-self-name]',

  // Captions
  CAPTIONS_CONTAINER: '[jsname="dsyhDe"], .a4cQT',
  CAPTION_TEXT: '[jsname="YSxPC"], .bh44bd',
  CAPTION_SPEAKER: '[jsname="bN97Pc"], .zs7s8d',

  // Meeting info
  MEETING_TITLE: '[data-meeting-title], [data-call-id]',
  MEETING_TIMER: '[aria-label*="meeting time"], [data-meeting-start-ts]',

  // Reactions panel
  REACTION_EMOJI: (emoji: string) => `[aria-label="${emoji}"], button:has-text("${emoji}")`,

  // Errors / prompts
  REMOVED_DIALOG: 'div:has-text("You\'ve been removed")',
  ENDED_DIALOG: 'div:has-text("You left the meeting"), div:has-text("The meeting has ended")',
} as const;
