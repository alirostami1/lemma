import type { JsonValue } from "@lemma/domain";
import {
  assertJsonValue,
  assertPlainRecord,
  assertSchemaVersion,
} from "./canonical-validation.js";
import { assertQuestionReferenceId } from "./question-reference.js";

export type QuestionValueExpression =
  | { schemaVersion: 1; type: "literal"; value: JsonValue }
  | { schemaVersion: 1; type: "reference"; referenceId: string };

export function questionValueExpression(
  input: unknown,
  failWith: (message: string) => never,
  referenceIds?: ReadonlySet<string>,
): QuestionValueExpression {
  assertPlainRecord(
    input,
    "question value expression must be an object",
    failWith,
  );
  assertSchemaVersion(input, failWith);
  if (input.type === "literal") {
    assertJsonValue(input.value, "value", failWith);
    return { schemaVersion: 1, type: "literal", value: input.value };
  }
  if (input.type === "reference") {
    assertQuestionReferenceId(input.referenceId, "referenceId", failWith);
    if (referenceIds && !referenceIds.has(input.referenceId)) {
      failWith("question value expression references unknown reference id");
    }
    return {
      referenceId: input.referenceId,
      schemaVersion: 1,
      type: "reference",
    };
  }
  failWith("question value expression type is invalid");
}
