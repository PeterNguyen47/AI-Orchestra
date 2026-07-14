import "server-only";

import { createLogRecord, type LogContext, type LogLevel } from "./log-record";
import { getRuntimeConfig } from "./runtime-config";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function write(level: LogLevel, event: string, context: LogContext = {}): void {
  const config = getRuntimeConfig();
  if (levelPriority[level] < levelPriority[config.logLevel]) {
    return;
  }

  const line = JSON.stringify(
    createLogRecord({
      level,
      event,
      service: config.appName,
      version: config.appVersion,
      context,
    }),
  );

  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

export const logger = Object.freeze({
  debug: (event: string, context?: LogContext) => write("debug", event, context),
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) => write("error", event, context),
});
