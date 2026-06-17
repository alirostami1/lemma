import type { JsonValue } from "@lemma/domain";
import {
  assertArray,
  assertJsonValue,
  assertNonEmptyString,
  assertPlainRecord,
  assertSchemaVersion,
} from "./canonical-validation.js";
import { InvalidQuestionAnswerError } from "./errors.js";
import type { QuestionResponseField } from "./question-body.js";

export type QuestionResponseValue = JsonValue;

export type QuestionAnswer = {
  schemaVersion: 1;
  responses: Array<{
    responseFieldId: string;
    value: QuestionResponseValue;
  }>;
};

export function questionAnswer(
  input: unknown,
  responseFields?: readonly QuestionResponseField[],
): QuestionAnswer {
  assertPlainRecord(input, "question answer must be an object", fail);
  assertSchemaVersion(input, fail);
  assertArray(input.responses, "responses", fail);
  const allowed = responseFields
    ? new Set(responseFields.map((field) => field.id))
    : null;
  const seen = new Set<string>();
  const responses: QuestionAnswer["responses"] = [];
  for (const response of input.responses) {
    assertPlainRecord(response, "answer response must be an object", fail);
    assertNonEmptyString(response.responseFieldId, "responseFieldId", fail);
    if (seen.has(response.responseFieldId)) {
      fail("answer responses must be unique by responseFieldId");
    }
    seen.add(response.responseFieldId);
    if (allowed && !allowed.has(response.responseFieldId)) {
      fail("answer response references unknown response field");
    }
    assertJsonValue(response.value, "answer value", fail);
    responses.push({
      responseFieldId: response.responseFieldId,
      value: response.value,
    });
  }
  return { schemaVersion: 1, responses };
}

function fail(message: string): never {
  throw new InvalidQuestionAnswerError(message);
}
