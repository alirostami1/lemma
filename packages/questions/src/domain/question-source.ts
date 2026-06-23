import {
  assertArray,
  assertPlainRecord,
  assertSchemaVersion,
} from "./canonical-validation.js";
import { InvalidQuestionSourcePlanError } from "./errors.js";
import {
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
} from "./ids.js";
import {
  questionBlueprintSourceId,
  questionBlueprintSourceName,
} from "./question-blueprint.js";

export type QuestionSourceEvidenceItem = {
  sourceId: string;
  sourceName: string;
  workbookId: string;
  workbookCalculationId: string;
  workbookSnapshotId: string;
  questionIndex: number;
  snapshotIndex: number;
  references: readonly string[];
};

export type QuestionSourceEvidence = {
  schemaVersion: 1;
  sources: readonly QuestionSourceEvidenceItem[];
};

export type QuestionSourcePlanReference = {
  referenceId?: string;
  sourceId?: string;
  ref?: string;
  workbookSnapshotId?: string;
  value?: unknown;
};

export type QuestionSourcePlan = {
  schemaVersion: 1;
  references: readonly QuestionSourcePlanReference[];
};

export function questionSourceEvidence(input: unknown): QuestionSourceEvidence {
  return parseQuestionSourceEvidence(input);
}

export function questionSourceEvidenceFromStore(
  input: unknown,
): QuestionSourceEvidence {
  return parseQuestionSourceEvidence(input);
}

export function questionSourcePlan(input: unknown): QuestionSourcePlan {
  return parseQuestionSourcePlan(input);
}

export function questionSourcePlanFromStore(
  input: unknown,
): QuestionSourcePlan {
  return parseQuestionSourcePlan(input);
}

function parseQuestionSourcePlan(input: unknown): QuestionSourcePlan {
  assertPlainRecord(input, "question source plan must be an object", fail);
  assertSchemaVersion(input, fail);
  assertArray(input.references, "references", fail);

  return {
    references: input.references.map((reference) => {
      assertPlainRecord(
        reference,
        "sourcePlan reference must be an object",
        fail,
      );
      return {
        ...optionalString(reference, "referenceId"),
        ...optionalString(reference, "sourceId"),
        ...optionalString(reference, "ref"),
        ...optionalString(reference, "workbookSnapshotId"),
        ...("value" in reference ? { value: reference.value } : {}),
      };
    }),
    schemaVersion: 1,
  };
}

function parseQuestionSourceEvidence(input: unknown): QuestionSourceEvidence {
  assertPlainRecord(input, "question source evidence must be an object", fail);
  assertSchemaVersion(input, fail);
  assertArray(input.sources, "sources", fail);

  const identities = new Set<string>();
  const sources = input.sources.map((source) => {
    assertPlainRecord(source, "sourceEvidence source must be an object", fail);
    if ("resolvedValue" in source) {
      fail("sourceEvidence source resolvedValue is not allowed");
    }
    if (!Array.isArray(source.references)) {
      fail("sourceEvidence source references must be an array");
    }
    const normalized = {
      questionIndex: nonNegativeInteger(source.questionIndex, "questionIndex"),
      references: source.references.map((reference, referenceIndex) => {
        if (typeof reference !== "string" || reference.length === 0) {
          fail(
            `sourceEvidence source references[${referenceIndex}] must be a non-empty string`,
          );
        }
        return reference;
      }),
      snapshotIndex: nonNegativeInteger(source.snapshotIndex, "snapshotIndex"),
      sourceId: questionBlueprintSourceId(source.sourceId),
      sourceName: questionBlueprintSourceName(source.sourceName),
      workbookCalculationId: workbookCalculationId(
        source.workbookCalculationId,
      ),
      workbookId: workbookId(source.workbookId),
      workbookSnapshotId: workbookSnapshotId(source.workbookSnapshotId),
    } satisfies QuestionSourceEvidenceItem;
    const identity = `${normalized.sourceId}:${normalized.questionIndex}`;
    if (identities.has(identity)) {
      fail(
        "sourceEvidence sources must be unique by sourceId and questionIndex",
      );
    }
    identities.add(identity);
    return normalized;
  });

  return { schemaVersion: 1, sources };
}

function optionalString(
  input: Record<string, unknown>,
  field: keyof QuestionSourcePlanReference,
) {
  const value = input[field];
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "string" || value.length === 0) {
    fail(`sourcePlan reference ${field} must be a non-empty string`);
  }
  return { [field]: value };
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(`sourceEvidence source ${field} must be a non-negative integer`);
  }
  return value;
}

function fail(message: string): never {
  throw new InvalidQuestionSourcePlanError(message);
}
