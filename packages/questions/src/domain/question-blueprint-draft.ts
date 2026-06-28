import { type Timestamped, touch } from "@lemma/domain";
import {
  InvalidQuestionFieldError,
  InvalidQuestionStateTransitionError,
} from "./errors.js";
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
  questionBlueprintSourceIdsUsedByDocument,
  questionBlueprintSourceName,
} from "./question-blueprint.js";
import {
  type QuestionBlueprintDocument,
  questionBlueprintDocument,
} from "./question-blueprint-document.js";
import type { QuestionBlueprintVersionSource } from "./question-blueprint-version.js";
import {
  type QuestionBlueprintDescription,
  type QuestionBlueprintName,
  questionBlueprintDescription,
  questionBlueprintName,
} from "./question-values.js";

export type QuestionBlueprintDraftId = string & {
  readonly __brand: "QuestionBlueprintDraftId";
};
export type QuestionBlueprintDraftStatus =
  | "draft"
  | "publishing"
  | "published"
  | "discarded";

export type QuestionBlueprintDraftSource = {
  type: "workbook";
  sourceId: string;
  name: string;
  fileId: string | null;
  sourceDocumentId: SourceDocumentId | null;
  sourceRevisionId: SourceRevisionId | null;
  sourceArtifactId: SourceArtifactId | null;
  workbookId: WorkbookId | null;
  status: "local" | "uploaded" | "validated" | "invalid";
  originalName: string | null;
  byteSize: number | null;
  checksumSha256: string | null;
};

export type QuestionBlueprintDraftSourceIntent = {
  type: "workbook";
  sourceId: string;
  name: string;
};

export type QuestionBlueprintDraft = Timestamped & {
  id: QuestionBlueprintDraftId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  revision: number;
  blueprintId: QuestionBlueprintId | null;
  baseVersionId: QuestionBlueprintVersionId | null;
  publishedVersionId: QuestionBlueprintVersionId | null;
  publishIdempotencyKey: string | null;
  name: QuestionBlueprintName;
  description: QuestionBlueprintDescription | null;
  document: QuestionBlueprintDocument;
  sources: readonly QuestionBlueprintDraftSource[];
  status: QuestionBlueprintDraftStatus;
  lastSavedAt: Date;
  publishedAt: Date | null;
  discardedAt: Date | null;
};

export type PublishableWorkbookDraftSource = QuestionBlueprintDraftSource & {
  status: "validated";
  fileId: string;
  sourceDocumentId: SourceDocumentId;
  sourceRevisionId: SourceRevisionId;
  sourceArtifactId: SourceArtifactId;
  workbookId: WorkbookId;
  originalName: string;
  byteSize: number;
  checksumSha256: string;
};

export function questionBlueprintDraftId(
  value: unknown,
): QuestionBlueprintDraftId {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/u.test(value)) {
    throw new InvalidQuestionFieldError(
      "questionBlueprintDraftId must be a UUID",
    );
  }
  return value as QuestionBlueprintDraftId;
}

export function questionBlueprintDraftSourcesFromRows(
  input: unknown,
): QuestionBlueprintDraftSource[] {
  if (!Array.isArray(input)) {
    throw new InvalidQuestionFieldError(
      "question blueprint draft sources must be an array",
    );
  }
  const ids = new Set<string>();
  return input.map((value) => {
    if (!value || typeof value !== "object") {
      throw new InvalidQuestionFieldError(
        "question blueprint draft source must be an object",
      );
    }
    const source = value as Record<string, unknown>;
    if (source.type !== "workbook") {
      throw new InvalidQuestionFieldError(
        "question blueprint draft source type is invalid",
      );
    }
    const sourceId = questionBlueprintSourceId(source.sourceId);
    if (ids.has(sourceId)) {
      throw new InvalidQuestionFieldError(
        "question blueprint draft source ids must be unique",
      );
    }
    ids.add(sourceId);
    const status = source.status;
    if (
      !["local", "uploaded", "validated", "invalid"].includes(String(status))
    ) {
      throw new InvalidQuestionFieldError(
        "question blueprint draft source status is invalid",
      );
    }
    return {
      byteSize: nullablePositiveNumber(source.byteSize),
      checksumSha256: nullableChecksum(source.checksumSha256),
      fileId: nullableString(source.fileId, "fileId"),
      name: questionBlueprintSourceName(source.name),
      originalName: nullableString(source.originalName, "originalName"),
      sourceId,
      sourceArtifactId: nullableSourceArtifactId(source.sourceArtifactId),
      sourceDocumentId: nullableSourceDocumentId(source.sourceDocumentId),
      sourceRevisionId: nullableSourceRevisionId(source.sourceRevisionId),
      status: status as QuestionBlueprintDraftSource["status"],
      type: "workbook",
      workbookId:
        source.workbookId === null ? null : workbookId(source.workbookId),
    };
  });
}

export function questionBlueprintDraftSourceIntents(
  input: unknown,
): QuestionBlueprintDraftSourceIntent[] {
  if (!Array.isArray(input)) {
    throw new InvalidQuestionFieldError(
      "question blueprint draft source intents must be an array",
    );
  }
  const ids = new Set<string>();
  return input.map((value) => {
    if (!value || typeof value !== "object") {
      throw new InvalidQuestionFieldError(
        "question blueprint draft source intent must be an object",
      );
    }
    const source = value as Record<string, unknown>;
    assertSourceIntentFields(source);
    if (source.type !== "workbook") {
      throw new InvalidQuestionFieldError(
        "question blueprint draft source intent type is invalid",
      );
    }
    const sourceId = questionBlueprintSourceId(source.sourceId);
    if (ids.has(sourceId)) {
      throw new InvalidQuestionFieldError(
        "question blueprint draft source intent ids must be unique",
      );
    }
    ids.add(sourceId);
    return {
      name: questionBlueprintSourceName(source.name),
      sourceId,
      type: "workbook",
    };
  });
}

export function createQuestionBlueprintDraft(
  input: Omit<
    QuestionBlueprintDraft,
    | keyof Timestamped
    | "status"
    | "lastSavedAt"
    | "publishedAt"
    | "discardedAt"
    | "revision"
    | "publishedVersionId"
    | "publishIdempotencyKey"
  >,
  at: Date,
): QuestionBlueprintDraft {
  assertDraftTargetBasePair({ ...input, status: "draft" });
  assertDraftReferences(input.document, input.sources);
  return {
    ...input,
    createdAt: at,
    discardedAt: null,
    lastSavedAt: at,
    publishedAt: null,
    publishedVersionId: null,
    publishIdempotencyKey: null,
    revision: 1,
    status: "draft",
    updatedAt: at,
  };
}

export function reconstituteQuestionBlueprintDraft(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  blueprintId: string | null;
  baseVersionId: string | null;
  publishedVersionId: string | null;
  publishIdempotencyKey: string | null;
  revision: number;
  name: string;
  description: string | null;
  document: unknown;
  sources: unknown;
  status: string;
  lastSavedAt: Date;
  publishedAt: Date | null;
  discardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): QuestionBlueprintDraft {
  const blueprintId = input.blueprintId
    ? questionBlueprintId(input.blueprintId)
    : null;
  const baseVersionId = input.baseVersionId
    ? questionBlueprintVersionId(input.baseVersionId)
    : null;
  const publishedVersionId = input.publishedVersionId
    ? questionBlueprintVersionId(input.publishedVersionId)
    : null;
  const publishIdempotencyKey = input.publishIdempotencyKey
    ? questionBlueprintDraftPublishIdempotencyKey(input.publishIdempotencyKey)
    : null;
  const status = draftStatus(input.status);
  assertDraftTargetBasePair({
    baseVersionId,
    blueprintId,
    publishIdempotencyKey,
    publishedVersionId,
    status,
  });
  const document = questionBlueprintDocument(input.document);
  const sources = questionBlueprintDraftSourcesFromRows(input.sources);
  assertDraftReferences(document, sources);
  if (status === "published") {
    assertPublishedDraftSources({ document, sources });
  }
  return {
    blueprintId,
    baseVersionId,
    createdAt: input.createdAt,
    createdByUserId: userId(input.createdByUserId),
    description: questionBlueprintDescription(input.description),
    discardedAt: input.discardedAt,
    document,
    id: questionBlueprintDraftId(input.id),
    lastSavedAt: input.lastSavedAt,
    name: questionBlueprintName(input.name),
    ownerUserId: userId(input.ownerUserId),
    publishedAt: input.publishedAt,
    publishedVersionId,
    publishIdempotencyKey,
    revision: questionBlueprintDraftRevision(input.revision),
    sources,
    status,
    updatedAt: input.updatedAt,
  };
}

export function updateQuestionBlueprintDraft(
  draft: QuestionBlueprintDraft,
  input: Pick<
    QuestionBlueprintDraft,
    "name" | "description" | "document" | "sources"
  >,
  at: Date,
): QuestionBlueprintDraft {
  assertMutable(draft);
  assertDraftReferences(input.document, input.sources);
  return {
    ...touch(draft, at),
    ...input,
    lastSavedAt: at,
    revision: nextQuestionBlueprintDraftRevision(draft.revision),
  };
}

export function attachDraftSourceFile(
  draft: QuestionBlueprintDraft,
  input: {
    sourceId: string;
    fileId: string;
    sourceDocumentId: SourceDocumentId;
    sourceRevisionId: SourceRevisionId;
    sourceArtifactId: SourceArtifactId;
    workbookId: WorkbookId;
    status: "uploaded" | "validated" | "invalid";
    originalName: string;
    byteSize: number;
    checksumSha256: string;
  },
  at: Date,
): QuestionBlueprintDraft {
  assertMutable(draft);
  const sourceId = questionBlueprintSourceId(input.sourceId);
  const exists = draft.sources.some((source) => source.sourceId === sourceId);
  if (!exists) {
    throw new InvalidQuestionFieldError(
      `question blueprint source ${sourceId} is not attached to this draft`,
    );
  }
  return {
    ...touch(draft, at),
    revision: nextQuestionBlueprintDraftRevision(draft.revision),
    sources: draft.sources.map((source) =>
      source.sourceId === sourceId
        ? {
            ...source,
            byteSize: input.byteSize,
            checksumSha256: input.checksumSha256,
            fileId: input.fileId,
            originalName: input.originalName,
            sourceArtifactId: input.sourceArtifactId,
            sourceDocumentId: input.sourceDocumentId,
            sourceRevisionId: input.sourceRevisionId,
            status: input.status,
            workbookId: input.workbookId,
          }
        : source,
    ),
  };
}

export function markQuestionBlueprintDraftPublished(
  draft: QuestionBlueprintDraft,
  input: {
    blueprintId: QuestionBlueprintId;
    idempotencyKey: string;
    sources: readonly QuestionBlueprintDraftSource[];
    versionId: QuestionBlueprintVersionId;
  },
  at: Date,
): QuestionBlueprintDraft {
  assertMutable(draft);
  assertPublishedDraftSources({
    document: draft.document,
    sources: input.sources,
  });
  return {
    ...touch(draft, at),
    blueprintId: input.blueprintId,
    publishedAt: at,
    publishedVersionId: input.versionId,
    publishIdempotencyKey: questionBlueprintDraftPublishIdempotencyKey(
      input.idempotencyKey,
    ),
    revision: nextQuestionBlueprintDraftRevision(draft.revision),
    sources: input.sources,
    status: "published",
  };
}

export function discardQuestionBlueprintDraft(
  draft: QuestionBlueprintDraft,
  at: Date,
): QuestionBlueprintDraft {
  assertMutable(draft);
  return {
    ...touch(draft, at),
    discardedAt: at,
    revision: nextQuestionBlueprintDraftRevision(draft.revision),
    status: "discarded",
  };
}

export function questionBlueprintDraftRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new InvalidQuestionFieldError(
      "question blueprint draft revision must be a positive integer",
    );
  }
  return value as number;
}

export function questionBlueprintDraftPublishIdempotencyKey(
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new InvalidQuestionFieldError(
      "question blueprint draft publish idempotency key must be a string",
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    throw new InvalidQuestionFieldError(
      "question blueprint draft publish idempotency key must be between 1 and 128 characters",
    );
  }
  return trimmed;
}

function nextQuestionBlueprintDraftRevision(value: number): number {
  return questionBlueprintDraftRevision(value + 1);
}

function assertSourceIntentFields(source: Record<string, unknown>): void {
  const allowed = new Set(["name", "sourceId", "type"]);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      throw new InvalidQuestionFieldError(
        `question blueprint draft source intent cannot include ${key}`,
      );
    }
  }
}

function assertDraftTargetBasePair(input: {
  blueprintId: QuestionBlueprintId | null;
  baseVersionId: QuestionBlueprintVersionId | null;
  publishedVersionId?: QuestionBlueprintVersionId | null;
  publishIdempotencyKey?: string | null;
  status: QuestionBlueprintDraftStatus;
}): void {
  if (input.baseVersionId !== null && input.blueprintId === null) {
    throw new InvalidQuestionFieldError(
      "question blueprint drafts cannot have a base version without a blueprint",
    );
  }
  if (
    (input.status === "draft" || input.status === "publishing") &&
    input.blueprintId !== null &&
    input.baseVersionId === null
  ) {
    throw new InvalidQuestionFieldError(
      "targeted active question blueprint drafts must have a base version",
    );
  }
  if (input.status === "published" && input.blueprintId === null) {
    throw new InvalidQuestionFieldError(
      "published question blueprint drafts must reference a blueprint",
    );
  }
  if (input.status === "published" && input.publishedVersionId === null) {
    throw new InvalidQuestionFieldError(
      "published question blueprint drafts must reference a published version",
    );
  }
  if (
    input.status === "published" &&
    (input.publishIdempotencyKey === null ||
      input.publishIdempotencyKey === undefined)
  ) {
    throw new InvalidQuestionFieldError(
      "published question blueprint drafts must store a publish idempotency key",
    );
  }
  if (input.status !== "published" && input.publishedVersionId != null) {
    throw new InvalidQuestionFieldError(
      "unpublished question blueprint drafts cannot reference a published version",
    );
  }
  if (input.status !== "published" && input.publishIdempotencyKey != null) {
    throw new InvalidQuestionFieldError(
      "unpublished question blueprint drafts cannot store a publish idempotency key",
    );
  }
}

function assertDraftReferences(
  document: QuestionBlueprintDocument,
  sources: readonly QuestionBlueprintDraftSource[],
) {
  const attached = new Set(sources.map((source) => source.sourceId));
  for (const sourceId of questionBlueprintSourceIdsUsedByDocument(document)) {
    if (!attached.has(sourceId)) {
      throw new InvalidQuestionFieldError(
        `question blueprint source ${sourceId} is not attached to this draft`,
      );
    }
  }
}

function assertPublishedDraftSources(input: {
  document: QuestionBlueprintDocument;
  sources: readonly QuestionBlueprintDraftSource[];
}) {
  const sourcesById = new Map(
    input.sources.map((source) => [source.sourceId, source]),
  );
  for (const sourceId of questionBlueprintSourceIdsUsedByDocument(
    input.document,
  )) {
    const source = sourcesById.get(sourceId);
    if (!source) {
      throw new InvalidQuestionStateTransitionError(
        "published workbook sources must pin source document, revision, artifact, and workbook metadata",
      );
    }
    try {
      publishableWorkbookDraftSource(source);
    } catch {
      throw new InvalidQuestionStateTransitionError(
        "published workbook sources must pin source document, revision, artifact, and workbook metadata",
      );
    }
  }
}

export function publishableWorkbookDraftSource(
  source: QuestionBlueprintDraftSource,
): PublishableWorkbookDraftSource {
  if (
    source.type !== "workbook" ||
    source.status !== "validated" ||
    source.fileId === null ||
    source.originalName === null ||
    source.byteSize === null ||
    source.checksumSha256 === null ||
    source.workbookId === null ||
    source.sourceDocumentId === null ||
    source.sourceRevisionId === null ||
    source.sourceArtifactId === null
  ) {
    throw new InvalidQuestionStateTransitionError(
      "draft workbook source is not ready for publish",
    );
  }
  return {
    ...source,
    byteSize: source.byteSize,
    checksumSha256: source.checksumSha256,
    fileId: source.fileId,
    originalName: source.originalName,
    sourceArtifactId: source.sourceArtifactId,
    sourceDocumentId: source.sourceDocumentId,
    sourceRevisionId: source.sourceRevisionId,
    status: "validated",
    workbookId: source.workbookId,
  };
}

export function publishedWorkbookSourceFromDraft(
  source: QuestionBlueprintDraftSource,
): QuestionBlueprintSource {
  const ready = publishableWorkbookDraftSource(source);
  return {
    byteSize: ready.byteSize,
    checksumSha256: ready.checksumSha256,
    fileId: ready.fileId,
    name: ready.name,
    originalName: ready.originalName,
    sourceArtifactId: ready.sourceArtifactId,
    sourceDocumentId: ready.sourceDocumentId,
    sourceId: ready.sourceId,
    sourceRevisionId: ready.sourceRevisionId,
    type: "workbook",
    workbookId: ready.workbookId,
  };
}

export function publishedWorkbookVersionSourceFromDraft(
  source: QuestionBlueprintDraftSource,
): QuestionBlueprintVersionSource {
  const ready = publishableWorkbookDraftSource(source);
  return {
    byteSize: ready.byteSize,
    checksumSha256: ready.checksumSha256,
    fileId: ready.fileId,
    name: ready.name,
    originalName: ready.originalName,
    sourceArtifactId: ready.sourceArtifactId,
    sourceDocumentId: ready.sourceDocumentId,
    sourceId: ready.sourceId,
    sourceRevisionId: ready.sourceRevisionId,
    type: "workbook",
    workbookId: ready.workbookId,
  };
}

function assertMutable(draft: QuestionBlueprintDraft) {
  if (draft.status !== "draft") {
    throw new InvalidQuestionStateTransitionError(
      "question blueprint draft cannot change from current state",
    );
  }
}

function draftStatus(value: string): QuestionBlueprintDraftStatus {
  if (!["draft", "publishing", "published", "discarded"].includes(value)) {
    throw new InvalidQuestionFieldError(
      "question blueprint draft status is invalid",
    );
  }
  return value as QuestionBlueprintDraftStatus;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidQuestionFieldError(`${field} must be a string or null`);
  }
  return value;
}

function nullablePositiveNumber(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidQuestionFieldError(
      "byteSize must be a positive integer or null",
    );
  }
  return value;
}

function nullableChecksum(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new InvalidQuestionFieldError(
      "checksumSha256 must be lowercase SHA-256 or null",
    );
  }
  return value;
}

function nullableSourceDocumentId(value: unknown): SourceDocumentId | null {
  return value === undefined || value === null ? null : sourceDocumentId(value);
}

function nullableSourceRevisionId(value: unknown): SourceRevisionId | null {
  return value === undefined || value === null ? null : sourceRevisionId(value);
}

function nullableSourceArtifactId(value: unknown): SourceArtifactId | null {
  return value === undefined || value === null ? null : sourceArtifactId(value);
}
