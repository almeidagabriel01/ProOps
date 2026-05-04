type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type LogContext = Record<string, unknown>;

function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    severity: level, // GCP Cloud Logging uses "severity" as a special field
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (level === "ERROR") {
    console.error(JSON.stringify(entry));
  } else if (level === "WARN") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    log("DEBUG", message, context),
  info: (message: string, context?: LogContext) =>
    log("INFO", message, context),
  warn: (message: string, context?: LogContext) =>
    log("WARN", message, context),
  error: (message: string, context?: LogContext) =>
    log("ERROR", message, context),
};
