import type { JsonObject, Timestamped } from "@lemma/domain";
import { InvalidQuestionFieldError } from "./errors.js";
import {
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

export type SourceKind = "workbook" | "python";
export type SourceDocumentStatus = "active" | "archived" | "deleted";
export type SourceArtifactStatus =
  | "pending_validation"
  | "valid"
  | "invalid"
  | "archived"
  | "deleted";

export type SourceDocument = Timestamped & {
  id: SourceDocumentId;
  ownerUserId: UserId;
  name: string;
  kind: SourceKind;
  currentRevisionId: SourceRevisionId | null;
  status: SourceDocumentStatus;
  deletedAt: Date | null;
  retentionExpiresAt: Date | null;
};

export type SourceRevision = {
  id: SourceRevisionId;
  sourceDocumentId: SourceDocumentId;
  ownerUserId: UserId;
  kind: SourceKind;
  fileId: string | null;
  checksumSha256: string;
  byteSize: number;
  contentType: string;
  createdByUserId: UserId;
  parentRevisionId: SourceRevisionId | null;
  editorMetadata: JsonObject;
  createdAt: Date;
  deletedAt: Date | null;
  retentionExpiresAt: Date | null;
};

export type SourceArtifact = Timestamped & {
  id: SourceArtifactId;
  sourceRevisionId: SourceRevisionId;
  ownerUserId: UserId;
  kind: SourceKind;
  // Artifacts stay revision-bound in #102. Cross-document processed artifact reuse
  // needs a separate reusable artifact model and is intentionally deferred.
  processor: string;
  processorVersion: string;
  status: SourceArtifactStatus;
  workbookId: WorkbookId | null;
  artifactMetadata: JsonObject;
  validationError: JsonObject | null;
  deletedAt: Date | null;
  retentionExpiresAt: Date | null;
  collectedAt: Date | null;
};

export function createSourceDocument(
  input: Omit<
    SourceDocument,
    | keyof Timestamped
    | "status"
    | "deletedAt"
    | "retentionExpiresAt"
    | "currentRevisionId"
  > & { currentRevisionId?: SourceRevisionId | null },
  at: Date,
): SourceDocument {
  return {
    ...input,
    createdAt: at,
    currentRevisionId: input.currentRevisionId ?? null,
    deletedAt: null,
    retentionExpiresAt: null,
    kind: sourceKind(input.kind),
    name: sourceDocumentName(input.name),
    status: "active",
    updatedAt: at,
  };
}

export function createSourceRevision(
  input: Omit<SourceRevision, "deletedAt" | "retentionExpiresAt">,
): SourceRevision {
  if (input.parentRevisionId === input.id) {
    throw new InvalidQuestionFieldError("source revision cannot parent itself");
  }
  return {
    ...input,
    byteSize: positiveInteger(input.byteSize, "byteSize"),
    checksumSha256: checksumSha256(input.checksumSha256),
    contentType: nonEmpty(input.contentType, "contentType"),
    kind: sourceKind(input.kind),
    deletedAt: null,
    retentionExpiresAt: null,
  };
}

export function createSourceArtifact(
  input: Omit<
    SourceArtifact,
    keyof Timestamped | "deletedAt" | "retentionExpiresAt" | "collectedAt"
  >,
  at: Date,
): SourceArtifact {
  assertSourceArtifactState(input);
  return {
    ...input,
    createdAt: at,
    collectedAt: null,
    deletedAt: null,
    kind: sourceKind(input.kind),
    processor: nonEmpty(input.processor, "processor"),
    processorVersion: nonEmpty(input.processorVersion, "processorVersion"),
    status: sourceArtifactStatus(input.status),
    retentionExpiresAt: null,
    updatedAt: at,
  };
}

export function reconstituteSourceDocument(input: {
  id: string;
  ownerUserId: string;
  name: string;
  kind: string;
  currentRevisionId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  retentionExpiresAt: Date | null;
}): SourceDocument {
  return {
    createdAt: input.createdAt,
    currentRevisionId: input.currentRevisionId
      ? sourceRevisionId(input.currentRevisionId)
      : null,
    deletedAt: input.deletedAt,
    id: sourceDocumentId(input.id),
    kind: sourceKind(input.kind),
    name: sourceDocumentName(input.name),
    ownerUserId: userId(input.ownerUserId),
    retentionExpiresAt: input.retentionExpiresAt,
    status: sourceDocumentStatus(input.status),
    updatedAt: input.updatedAt,
  };
}

export function reconstituteSourceRevision(input: {
  id: string;
  sourceDocumentId: string;
  ownerUserId: string;
  kind: string;
  fileId: string | null;
  checksumSha256: string;
  byteSize: number;
  contentType: string;
  createdByUserId: string;
  parentRevisionId: string | null;
  editorMetadata: JsonObject;
  createdAt: Date;
  deletedAt: Date | null;
  retentionExpiresAt: Date | null;
}): SourceRevision {
  return {
    ...createSourceRevision({
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256,
      contentType: input.contentType,
      createdAt: input.createdAt,
      createdByUserId: userId(input.createdByUserId),
      editorMetadata: input.editorMetadata,
      fileId: input.fileId,
      id: sourceRevisionId(input.id),
      kind: sourceKind(input.kind),
      ownerUserId: userId(input.ownerUserId),
      parentRevisionId: input.parentRevisionId
        ? sourceRevisionId(input.parentRevisionId)
        : null,
      sourceDocumentId: sourceDocumentId(input.sourceDocumentId),
    }),
    deletedAt: input.deletedAt,
    retentionExpiresAt: input.retentionExpiresAt,
  };
}

export function reconstituteSourceArtifact(input: {
  id: string;
  sourceRevisionId: string;
  ownerUserId: string;
  kind: string;
  processor: string;
  processorVersion: string;
  status: string;
  workbookId: string | null;
  artifactMetadata: JsonObject;
  validationError: JsonObject | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  retentionExpiresAt: Date | null;
  collectedAt: Date | null;
}): SourceArtifact {
  const artifact = {
    artifactMetadata: input.artifactMetadata,
    collectedAt: input.collectedAt,
    createdAt: input.createdAt,
    id: sourceArtifactId(input.id),
    deletedAt: input.deletedAt,
    kind: sourceKind(input.kind),
    ownerUserId: userId(input.ownerUserId),
    processor: nonEmpty(input.processor, "processor"),
    processorVersion: nonEmpty(input.processorVersion, "processorVersion"),
    retentionExpiresAt: input.retentionExpiresAt,
    sourceRevisionId: sourceRevisionId(input.sourceRevisionId),
    status: sourceArtifactStatus(input.status),
    updatedAt: input.updatedAt,
    validationError: input.validationError,
    workbookId: input.workbookId ? workbookId(input.workbookId) : null,
  };
  assertSourceArtifactState(artifact);
  return artifact;
}

export function tombstoneSourceDocument(
  document: SourceDocument,
  at: Date,
  retentionExpiresAt: Date,
): SourceDocument {
  if (document.status === "deleted") return document;
  return {
    ...document,
    deletedAt: at,
    retentionExpiresAt,
    status: "deleted",
    updatedAt: at,
  };
}

export function tombstoneSourceRevision(
  revision: SourceRevision,
  at: Date,
  retentionExpiresAt: Date,
): SourceRevision {
  if (revision.deletedAt) return revision;
  return { ...revision, deletedAt: at, retentionExpiresAt };
}

export function tombstoneSourceArtifact(
  artifact: SourceArtifact,
  at: Date,
  retentionExpiresAt: Date,
): SourceArtifact {
  if (artifact.deletedAt) return artifact;
  return { ...artifact, deletedAt: at, retentionExpiresAt, updatedAt: at };
}

export function markSourceArtifactCollected(
  artifact: SourceArtifact,
  at: Date,
): SourceArtifact {
  return { ...artifact, collectedAt: at, status: "deleted", updatedAt: at };
}

export function sourceKind(value: unknown): SourceKind {
  if (value !== "workbook" && value !== "python") {
    throw new InvalidQuestionFieldError("source kind is invalid");
  }
  return value;
}

export function sourceArtifactStatus(value: unknown): SourceArtifactStatus {
  if (
    !["pending_validation", "valid", "invalid", "archived", "deleted"].includes(
      String(value),
    )
  ) {
    throw new InvalidQuestionFieldError("source artifact status is invalid");
  }
  return value as SourceArtifactStatus;
}

function sourceDocumentStatus(value: unknown): SourceDocumentStatus {
  if (!["active", "archived", "deleted"].includes(String(value))) {
    throw new InvalidQuestionFieldError("source document status is invalid");
  }
  return value as SourceDocumentStatus;
}

function sourceDocumentName(value: unknown): string {
  return nonEmpty(value, "sourceDocumentName");
}

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidQuestionFieldError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new InvalidQuestionFieldError(`${field} must be a positive integer`);
  }
  return value as number;
}

function checksumSha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new InvalidQuestionFieldError(
      "checksumSha256 must be lowercase SHA-256",
    );
  }
  return value;
}

function assertSourceArtifactState(input: {
  kind: SourceKind;
  status: SourceArtifactStatus;
  workbookId: WorkbookId | null;
}): void {
  if (
    input.status === "valid" &&
    input.kind === "workbook" &&
    !input.workbookId
  ) {
    throw new InvalidQuestionFieldError(
      "valid workbook source artifact must reference a workbook",
    );
  }
  if (input.workbookId && input.kind !== "workbook") {
    throw new InvalidQuestionFieldError(
      "source artifact with workbook must be workbook kind",
    );
  }
}
