import {
  assertJsonValue,
  assertNonEmptyString,
  assertPlainRecord,
  assertSchemaVersion,
} from "./canonical-validation.js";
import { InvalidQuestionProducerError } from "./errors.js";

export type QuestionProducer = {
  schemaVersion: 1;
  compiler: string;
  source?: { [key: string]: unknown };
};

export function questionProducer(input: unknown): QuestionProducer {
  assertPlainRecord(input, "question producer must be an object", fail);
  assertSchemaVersion(input, fail);
  assertNonEmptyString(input.compiler, "producer compiler", fail);
  if (input.source !== undefined) {
    assertPlainRecord(input.source, "producer source must be an object", fail);
    assertJsonValue(input.source, "producer source", fail);
  }
  return {
    compiler: input.compiler,
    schemaVersion: 1,
    ...(input.source === undefined ? {} : { source: input.source }),
  };
}

function fail(message: string): never {
  throw new InvalidQuestionProducerError(message);
}
