import { InvalidQuestionFieldError } from "./errors.js";
import {
  type QuestionBlueprintId,
  type QuestionBlueprintVersionId,
  questionBlueprintId,
  questionBlueprintVersionId,
  type SourceArtifactId,
  type SourceDocumentId,
  type SourceRevisionId,
  sourceArtifactId,
  sourceDocumentId,
  sourceRevisionId,
  type UserId,
  userId,
  type WorkbookId,
  workbookId,
} from "./ids.js";
import {
  type QuestionBlueprintSource,
  questionBlueprintSourceId,
  questionBlueprintSourceName,
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
  sources: readonly QuestionBlueprintVersionSource[];
  publishedAt: Date;
  createdAt: Date;
};

export type QuestionBlueprintVersionSource = {
  type: "workbook";
  sourceId: string;
  name: string;
  fileId: string;
  sourceDocumentId: SourceDocumentId;
  sourceRevisionId: SourceRevisionId;
  sourceArtifactId: SourceArtifactId;
  workbookId: WorkbookId;
  originalName: string;
  byteSize: number;
  checksumSha256: string;
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
    sources: readonly (
      | QuestionBlueprintSource
      | QuestionBlueprintVersionSource
    )[];
  },
  at: Date,
): QuestionBlueprintVersion {
  const sources = questionBlueprintVersionSourcesReferencedByDocument(
    input.document,
    toVersionSources(input.sources),
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
  const parsedSources = questionBlueprintVersionSourcesFromRows(input.sources);
  const sources = questionBlueprintVersionSourcesReferencedByDocument(
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

export function questionBlueprintVersionSourcesFromRows(
  input: unknown,
): QuestionBlueprintVersionSource[] {
  if (!Array.isArray(input)) {
    throw new InvalidQuestionFieldError(
      "question blueprint version sources must be an array",
    );
  }
  const ids = new Set<string>();
  return input.map((source) => {
    if (typeof source !== "object" || source === null) {
      throw new InvalidQuestionFieldError(
        "question blueprint version source must be an object",
      );
    }
    const record = source as Record<string, unknown>;
    if (record.type !== "workbook") {
      throw new InvalidQuestionFieldError(
        "question blueprint version source type is invalid",
      );
    }
    const sourceId = questionBlueprintSourceId(record.sourceId);
    if (ids.has(sourceId)) {
      throw new InvalidQuestionFieldError(
        "question blueprint version source ids must be unique",
      );
    }
    ids.add(sourceId);
    return {
      byteSize: requiredPositiveNumber(record.byteSize, "byteSize"),
      checksumSha256: requiredChecksum(record.checksumSha256, "checksumSha256"),
      fileId: requiredString(record.fileId, "fileId"),
      name: questionBlueprintSourceName(record.name),
      originalName: requiredString(record.originalName, "originalName"),
      sourceId,
      sourceArtifactId: requiredSourceArtifactId(record.sourceArtifactId),
      sourceDocumentId: requiredSourceDocumentId(record.sourceDocumentId),
      sourceRevisionId: requiredSourceRevisionId(record.sourceRevisionId),
      type: "workbook",
      workbookId: workbookId(record.workbookId),
    };
  });
}

function toVersionSources(
  sources: readonly (
    | QuestionBlueprintSource
    | QuestionBlueprintVersionSource
  )[],
): QuestionBlueprintVersionSource[] {
  return sources.map((source) => ({
    byteSize: source.byteSize,
    checksumSha256: source.checksumSha256,
    fileId: source.fileId,
    name: source.name,
    originalName: source.originalName,
    sourceId: source.sourceId,
    sourceArtifactId: source.sourceArtifactId,
    sourceDocumentId: source.sourceDocumentId,
    sourceRevisionId: source.sourceRevisionId,
    type: "workbook",
    workbookId: source.workbookId,
  }));
}

export function questionBlueprintVersionSourcesReferencedByDocument(
  document: QuestionBlueprintDocument,
  sources: readonly QuestionBlueprintVersionSource[],
): QuestionBlueprintVersionSource[] {
  const minimal = questionBlueprintSourcesReferencedByDocument(
    document,
    sources.map((source) => ({
      byteSize: source.byteSize,
      checksumSha256: source.checksumSha256,
      fileId: source.fileId,
      name: source.name,
      originalName: source.originalName,
      sourceId: source.sourceId,
      sourceArtifactId: source.sourceArtifactId,
      sourceDocumentId: source.sourceDocumentId,
      sourceRevisionId: source.sourceRevisionId,
      type: source.type,
      workbookId: source.workbookId,
    })),
  );
  const sourceById = new Map(
    sources.map((source) => [source.sourceId, source]),
  );
  return minimal.map((source) => {
    const full = sourceById.get(source.sourceId);
    if (!full) {
      throw new InvalidQuestionFieldError(
        "question blueprint version source is invalid",
      );
    }
    return full;
  });
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidQuestionFieldError(`${field} must be a non-empty string`);
  }
  return value;
}

function requiredPositiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidQuestionFieldError(`${field} must be a positive integer`);
  }
  return value;
}

function requiredChecksum(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new InvalidQuestionFieldError(`${field} must be lowercase SHA-256`);
  }
  return value;
}

function requiredSourceDocumentId(value: unknown): SourceDocumentId {
  if (value === undefined || value === null) {
    throw new InvalidQuestionFieldError(
      "sourceDocumentId must be present for version workbook sources",
    );
  }
  return sourceDocumentId(value);
}

function requiredSourceRevisionId(value: unknown): SourceRevisionId {
  if (value === undefined || value === null) {
    throw new InvalidQuestionFieldError(
      "sourceRevisionId must be present for version workbook sources",
    );
  }
  return sourceRevisionId(value);
}

function requiredSourceArtifactId(value: unknown): SourceArtifactId {
  if (value === undefined || value === null) {
    throw new InvalidQuestionFieldError(
      "sourceArtifactId must be present for version workbook sources",
    );
  }
  return sourceArtifactId(value);
}
