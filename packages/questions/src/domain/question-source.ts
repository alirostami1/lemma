import {
  assertArray,
  assertPlainRecord,
  assertSchemaVersion,
  assertUniqueIds,
} from "./canonical-validation.js";
import { InvalidQuestionSourcePlanError } from "./errors.js";
import {
  assertQuestionReferenceId,
  type QuestionReferenceSource,
  questionReferenceSourceFromStore,
  questionReferenceSource,
} from "./question-reference.js";

export type QuestionSourceReference = {
  id: string;
  source: QuestionReferenceSource;
  resolved?: boolean;
};

export type QuestionSourcePlan = {
  schemaVersion: 1;
  references: QuestionSourceReference[];
};

export function questionSourcePlan(input: unknown): QuestionSourcePlan {
  return questionSourcePlanStrict(input);
}

export function questionSourcePlanFromStore(input: unknown): QuestionSourcePlan {
  return questionSourcePlanLegacy(input);
}

function questionSourcePlanStrict(input: unknown): QuestionSourcePlan {
  assertPlainRecord(input, "question source plan must be an object", fail);
  assertSchemaVersion(input, fail);
  assertArray(input.references, "references", fail);
  assertUniqueIds(input.references, "sourcePlan.references", fail);
  const references = input.references.map((reference) => {
    assertPlainRecord(
      reference,
      "sourcePlan reference must be an object",
      fail,
    );
    assertQuestionReferenceId(reference.id, "sourcePlan reference id", fail);
    if (
      reference.resolved !== undefined &&
      typeof reference.resolved !== "boolean"
    ) {
      fail("sourcePlan reference resolved must be a boolean");
    }
    return {
      id: reference.id,
      source: questionReferenceSource(reference.source, fail),
      ...(reference.resolved === undefined
        ? {}
        : { resolved: reference.resolved }),
    };
  });
  return { schemaVersion: 1, references };
}

function questionSourcePlanLegacy(input: unknown): QuestionSourcePlan {
  assertPlainRecord(input, "question source plan must be an object", fail);
  assertSchemaVersion(input, fail);
  assertArray(input.references, "references", fail);
  assertUniqueIds(input.references, "sourcePlan.references", fail);
  const references = input.references.map((reference) => {
    assertPlainRecord(
      reference,
      "sourcePlan reference must be an object",
      fail,
    );
    assertQuestionReferenceId(reference.id, "sourcePlan reference id", fail);
    if (
      reference.resolved !== undefined &&
      typeof reference.resolved !== "boolean"
    ) {
      fail("sourcePlan reference resolved must be a boolean");
    }
    return {
      id: reference.id,
      source: questionReferenceSourceFromStore(reference.source, fail),
      ...(reference.resolved === undefined
        ? {}
        : { resolved: reference.resolved }),
    };
  });
  return { schemaVersion: 1, references };
}

function fail(message: string): never {
  throw new InvalidQuestionSourcePlanError(message);
}
