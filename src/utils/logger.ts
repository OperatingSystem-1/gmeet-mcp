type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, msg: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${msg}`;
  if (data && Object.keys(data).length > 0) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

/** All logging goes to stderr — stdout is reserved for MCP stdio transport */
export const logger = {
  debug(msg: string, data?: Record<string, unknown>) {
    if (shouldLog("debug")) process.stderr.write(formatMessage("debug", msg, data) + "\n");
  },
  info(msg: string, data?: Record<string, unknown>) {
    if (shouldLog("info")) process.stderr.write(formatMessage("info", msg, data) + "\n");
  },
  warn(msg: string, data?: Record<string, unknown>) {
    if (shouldLog("warn")) process.stderr.write(formatMessage("warn", msg, data) + "\n");
  },
  error(msg: string, data?: Record<string, unknown>) {
    if (shouldLog("error")) process.stderr.write(formatMessage("error", msg, data) + "\n");
  },
};
