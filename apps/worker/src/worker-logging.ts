export type WorkerLogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

export type WorkerLogger = {
  info(message: string, fields?: WorkerLogFields): void;
  error(message: string, fields?: WorkerLogFields): void;
};

export const consoleWorkerLogger: WorkerLogger = {
  info(message, fields) {
    console.info(message, compactFields(fields));
  },
  error(message, fields) {
    console.error(message, compactFields(fields));
  },
};

export function logWorkerInfo(
  message: string,
  fields?: WorkerLogFields,
  logger = consoleWorkerLogger,
): void {
  logger.info(message, fields);
}

export function logWorkerError(
  message: string,
  fields: WorkerLogFields,
  error: unknown,
  logger = consoleWorkerLogger,
): void {
  logger.error(message, {
    ...fields,
    ...errorFields(error),
  });
}

function errorFields(error: unknown): WorkerLogFields {
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

function compactFields(fields?: WorkerLogFields): WorkerLogFields {
  if (!fields) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as WorkerLogFields;
}
