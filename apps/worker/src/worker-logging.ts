import {
  createConsoleStructuredLogger,
  errorLogFields,
  type LogFields,
  type StructuredLogger,
} from "@lemma/observability";

export type WorkerLogFields = LogFields;
export type WorkerLogger = Pick<StructuredLogger, "info" | "error">;

export const consoleWorkerLogger: WorkerLogger =
  createConsoleStructuredLogger("worker");

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
    ...errorLogFields(error),
  });
}
