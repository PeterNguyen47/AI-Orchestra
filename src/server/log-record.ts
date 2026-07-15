export const REDACTED_VALUE = "[REDACTED]";
export const CIRCULAR_VALUE = "[CIRCULAR]";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

export type LogRecord = Readonly<{
  timestamp: string;
  level: LogLevel;
  event: string;
  service: string;
  version: string;
  context: LogContext;
}>;

const sensitiveKeyPattern =
  /(api[_-]?key|authorization|cookie|credential|password|secret|session|token)/i;
const eventNamePattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function sanitizeValue(value: unknown, key: string | undefined, seen: WeakSet<object>): unknown {
  if (key && sensitiveKeyPattern.test(key)) {
    return REDACTED_VALUE;
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return CIRCULAR_VALUE;
    }

    seen.add(value);
    return value.map((entry) => sanitizeValue(entry, undefined, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return CIRCULAR_VALUE;
    }

    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [
        nestedKey,
        sanitizeValue(nestedValue, nestedKey, seen),
      ]),
    );
  }

  return value;
}

export function sanitizeLogContext(context: LogContext): LogContext {
  return sanitizeValue(context, undefined, new WeakSet()) as LogContext;
}

export function createLogRecord(input: {
  level: LogLevel;
  event: string;
  service: string;
  version: string;
  context?: LogContext;
  now?: Date;
}): LogRecord {
  if (!eventNamePattern.test(input.event)) {
    throw new Error(`Invalid structured log event name: ${input.event}`);
  }

  return Object.freeze({
    timestamp: (input.now ?? new Date()).toISOString(),
    level: input.level,
    event: input.event,
    service: input.service,
    version: input.version,
    context: sanitizeLogContext(input.context ?? {}),
  });
}
