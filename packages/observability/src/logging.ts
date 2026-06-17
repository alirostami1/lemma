export type LogFieldValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogFieldValue>;

export type StructuredLogger = {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
};

export function createConsoleStructuredLogger(
  component: string,
): StructuredLogger {
  return {
    info(message, fields) {
      console.info(message, withComponent(component, fields));
    },
    warn(message, fields) {
      console.warn(message, withComponent(component, fields));
    },
    error(message, fields) {
      console.error(message, withComponent(component, fields));
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

function withComponent(component: string, fields?: LogFields): LogFields {
  return compactLogFields({
    "log.component": component,
    ...fields,
  });
}
