export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_LEVEL: LogLevel =
  typeof process !== "undefined" && process.env?.FORKBOT_LOG_LEVEL
    ? (process.env.FORKBOT_LOG_LEVEL as LogLevel)
    : "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

function timestamp(): string {
  return new Date().toISOString();
}

function prefix(level: LogLevel): string {
  return `[${timestamp()}] [${level.toUpperCase()}]`;
}

export const logger = {
  debug(msg: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("debug")) return;
    console.debug(prefix("debug"), msg, meta ?? "");
  },

  info(msg: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("info")) return;
    console.log(prefix("info"), msg, meta ?? "");
  },

  warn(msg: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("warn")) return;
    console.warn(prefix("warn"), msg, meta ?? "");
  },

  error(msg: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("error")) return;
    console.error(prefix("error"), msg, meta ?? "");
  },

  child(service: string): typeof logger {
    const childPrefix = `[${service}]`;
    const methods = {} as typeof logger;
    for (const level of Object.keys(LEVEL_PRIORITY) as LogLevel[]) {
      methods[level] = (msg: string, meta?: Record<string, unknown>) => {
        logger[level](`${childPrefix} ${msg}`, meta);
      };
    }
    return methods;
  },
};
