import pino, { type Logger } from "pino";

export type LogFieldValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogFieldValue>;

export type StructuredLogger = {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
};

export function createPinoStructuredLogger(
  component: string,
): StructuredLogger {
  const logger = pino().child({ "log.component": component });
  return createStructuredLogger(logger);
}

function createStructuredLogger(logger: Logger): StructuredLogger {
  return {
    info(message, fields) {
      logger.info(compactLogFields(fields), message);
    },
    warn(message, fields) {
      logger.warn(compactLogFields(fields), message);
    },
    error(message, fields) {
      logger.error(compactLogFields(fields), message);
    },
  };
}

export function errorLogFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      "error.name": error.name,
      "error.message": error.message,
      "error.stack": error.stack ?? null,
    };
  }
  return {
    "error.message": String(error),
  };
}

export function compactLogFields(fields?: LogFields): LogFields {
  if (!fields) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as LogFields;
}
