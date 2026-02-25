import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { setLogLevel } from "../utils/logger.js";

export interface Config {
  openaiApiKey: string;
  chromeExecutablePath?: string;
  chromeUserDataDir: string;
  ttsVoice: string;
  ttsModel: string;
  whisperModel: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

function loadConfigFile(): Partial<Config> {
  const configPath = join(homedir(), ".gmeet-mcp", "config.json");
  if (!existsSync(configPath)) return {};

  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as Partial<Config>;
  } catch {
    return {};
  }
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;

  const file = loadConfigFile();

  _config = {
    openaiApiKey: process.env.OPENAI_API_KEY ?? file.openaiApiKey ?? "",
    chromeExecutablePath: process.env.CHROME_EXECUTABLE_PATH ?? file.chromeExecutablePath,
    chromeUserDataDir:
      process.env.CHROME_USER_DATA_DIR ??
      file.chromeUserDataDir ??
      join(homedir(), ".gmeet-mcp", "chrome-profile"),
    ttsVoice: process.env.TTS_VOICE ?? file.ttsVoice ?? "alloy",
    ttsModel: process.env.TTS_MODEL ?? file.ttsModel ?? "gpt-4o-mini-tts",
    whisperModel: process.env.WHISPER_MODEL ?? file.whisperModel ?? "whisper-1",
    logLevel: (process.env.LOG_LEVEL ?? file.logLevel ?? "info") as Config["logLevel"],
  };

  setLogLevel(_config.logLevel);
  return _config;
}
