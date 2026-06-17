import {
  createPinoStructuredLogger,
  errorLogFields,
  type LogFields,
  type StructuredLogger,
} from "@lemma/observability";

export type WorkerLogFields = LogFields;
export type WorkerLogger = Pick<StructuredLogger, "info" | "error">;

export const workerLogger: WorkerLogger = createPinoStructuredLogger("worker");

export function logWorkerInfo(
  message: string,
  fields?: WorkerLogFields,
  logger = workerLogger,
): void {
  logger.info(message, fields);
}

export function logWorkerError(
  message: string,
  fields: WorkerLogFields,
  error: unknown,
  logger = workerLogger,
): void {
  logger.error(message, {
    ...fields,
    ...errorLogFields(error),
  });
}
