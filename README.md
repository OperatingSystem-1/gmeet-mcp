# gmeet-mcp

MCP server for Google Meet — join calls, speak, listen, and chat via AI agents.

## Architecture

```
Agent ──MCP stdio──▶ gmeet-mcp server
                        ├── SessionManager (multi-meeting)
                        ├── BrowserManager (Playwright + persistent Chrome profile)
                        ├── MeetPage (DOM automation: join, leave, chat, captions)
                        ├── AudioInjector (TTS → WAV → --use-file-for-fake-audio-capture)
                        ├── TTS Engine (OpenAI gpt-4o-mini-tts)
                        ├── AudioCapture (tab audio → WebM chunks)
                        └── Transcriber (Whisper API on captured audio)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Install Playwright Chromium

```bash
npx playwright install chromium
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your OpenAI API key
```

### 4. Authenticate with Google

Run the server and call the `authenticate` tool, which opens a headed browser for Google login. Credentials are persisted in `~/.gmeet-mcp/chrome-profile/`.

## Usage

### As an MCP server

Add to your MCP client config:

```json
{
  "mcpServers": {
    "gmeet": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/gmeet-mcp",
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Development

```bash
npm run dev
```

## Tools

| Tool | Description |
|------|-------------|
| `authenticate` | Open headed browser for Google login |
| `join_meeting` | Join a Google Meet by URL. Returns sessionId |
| `leave_meeting` | Leave a meeting by sessionId |
| `speak` | TTS text → audio injected into meeting mic |
| `get_transcript` | Get running transcript (speaker + text + timestamp) |
| `send_chat_message` | Send a chat message in the Meet |
| `get_chat_messages` | Read chat messages from the Meet |
| `get_participants` | List current participants |
| `get_meeting_status` | Meeting status, duration, mute state |
| `toggle_microphone` | Mute/unmute |
| `toggle_camera` | Enable/disable camera |
| `raise_hand` | Raise hand in meeting |
| `react` | Send emoji reaction |
| `take_screenshot` | Screenshot current meeting view |

## Configuration

All configuration can be set via environment variables or `~/.gmeet-mcp/config.json`.

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | Required for TTS and Whisper |
| `CHROME_EXECUTABLE_PATH` | Playwright bundled | Path to Chrome/Chromium |
| `CHROME_USER_DATA_DIR` | `~/.gmeet-mcp/chrome-profile` | Persistent profile dir |
| `TTS_VOICE` | `alloy` | OpenAI TTS voice |
| `TTS_MODEL` | `gpt-4o-mini-tts` | OpenAI TTS model |
| `WHISPER_MODEL` | `whisper-1` | OpenAI Whisper model |
| `LOG_LEVEL` | `info` | debug, info, warn, error |

## How It Works

- **Joining**: Playwright navigates to the Meet URL, handles the pre-join screen, and clicks "Join now"
- **Speaking**: Text is sent to OpenAI TTS, the resulting WAV is written to a file that Chrome reads via `--use-file-for-fake-audio-capture`
- **Listening**: Captions are scraped from the Meet DOM via a MutationObserver (with optional Whisper transcription of captured audio)
- **Chat**: DOM automation to open the chat panel, type messages, and read incoming messages
- **Auth**: Uses a persistent Chrome profile so you only need to log into Google once
