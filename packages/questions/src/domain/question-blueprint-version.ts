import { InvalidQuestionFieldError } from "./errors.js";
import {
  type QuestionBlueprintId,
  type QuestionBlueprintVersionId,
  questionBlueprintId,
  questionBlueprintVersionId,
  type UserId,
  userId,
} from "./ids.js";
import {
  type QuestionBlueprintSource,
  questionBlueprintSources,
  questionBlueprintSourcesReferencedByDocument,
} from "./question-blueprint.js";
import {
  type QuestionBlueprintDocument,
  questionBlueprintDocument,
} from "./question-blueprint-document.js";
import {
  type QuestionBlueprintDescription,
  type QuestionBlueprintName,
  questionBlueprintDescription,
  questionBlueprintName,
} from "./question-values.js";

export type QuestionBlueprintVersionNumber = number & {
  readonly __brand: "QuestionBlueprintVersionNumber";
};

export type QuestionBlueprintVersion = {
  id: QuestionBlueprintVersionId;
  blueprintId: QuestionBlueprintId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  versionNumber: QuestionBlueprintVersionNumber;
  parentVersionId: QuestionBlueprintVersionId | null;
  name: QuestionBlueprintName;
  description: QuestionBlueprintDescription | null;
  document: QuestionBlueprintDocument;
  sources: readonly QuestionBlueprintSource[];
  publishedAt: Date;
  createdAt: Date;
};

export function questionBlueprintVersionNumber(
  value: unknown,
): QuestionBlueprintVersionNumber {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new InvalidQuestionFieldError(
      "question blueprint version number must be a positive integer",
    );
  }
  return value as QuestionBlueprintVersionNumber;
}

export function createQuestionBlueprintVersion(
  input: {
    id: QuestionBlueprintVersionId;
    blueprintId: QuestionBlueprintId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    versionNumber: QuestionBlueprintVersionNumber;
    parentVersionId: QuestionBlueprintVersionId | null;
    name: QuestionBlueprintName;
    description: QuestionBlueprintDescription | null;
    document: QuestionBlueprintDocument;
    sources: readonly QuestionBlueprintSource[];
  },
  at: Date,
): QuestionBlueprintVersion {
  const sources = questionBlueprintSourcesReferencedByDocument(
    input.document,
    input.sources,
  );
  return {
    ...input,
    createdAt: at,
    publishedAt: at,
    sources,
  };
}

export function reconstituteQuestionBlueprintVersion(input: {
  id: string;
  blueprintId: string;
  ownerUserId: string;
  createdByUserId: string;
  versionNumber: number;
  parentVersionId: string | null;
  name: string;
  description: string | null;
  document: unknown;
  sources: unknown;
  publishedAt: Date;
  createdAt: Date;
}): QuestionBlueprintVersion {
  const document = questionBlueprintDocument(input.document);
  const parsedSources = questionBlueprintSources(input.sources);
  const sources = questionBlueprintSourcesReferencedByDocument(
    document,
    parsedSources,
  );
  return {
    blueprintId: questionBlueprintId(input.blueprintId),
    createdAt: input.createdAt,
    createdByUserId: userId(input.createdByUserId),
    description: questionBlueprintDescription(input.description),
    document,
    id: questionBlueprintVersionId(input.id),
    name: questionBlueprintName(input.name),
    ownerUserId: userId(input.ownerUserId),
    parentVersionId: input.parentVersionId
      ? questionBlueprintVersionId(input.parentVersionId)
      : null,
    publishedAt: input.publishedAt,
    sources,
    versionNumber: questionBlueprintVersionNumber(input.versionNumber),
  };
}
