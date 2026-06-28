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

export type PythonSourceRevisionMetadata = {
  encoding: "utf-8";
  entrypoint: "main.py";
  schemaVersion: 1;
};

export type PythonSourceArtifactMetadata = {
  audit: {
    eventSchemaVersion: 1;
  };
  runtime: {
    dependencyLockChecksumSha256: string | null;
    implementation: "cpython";
    imageDigest: string;
    version: string;
  };
  sandboxPolicy: {
    cpuTimeLimitMs: number;
    filesystem: "isolated";
    memoryLimitBytes: number;
    network: "disabled";
    wallClockTimeoutMs: number;
  };
  schemaVersion: 1;
  staticAnalysis: {
    analyzer: string;
    analyzerVersion: string;
    passed: boolean;
  };
};

const PYTHON_SOURCE_CONTENT_TYPE = "text/x-python; charset=utf-8";
const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;
const PYTHON_REVISION_METADATA_KEYS = [
  "schemaVersion",
  "encoding",
  "entrypoint",
] as const;
const PYTHON_ARTIFACT_METADATA_KEYS = [
  "schemaVersion",
  "runtime",
  "sandboxPolicy",
  "staticAnalysis",
  "audit",
] as const;
const PYTHON_RUNTIME_METADATA_KEYS = [
  "implementation",
  "version",
  "imageDigest",
  "dependencyLockChecksumSha256",
] as const;
const PYTHON_SANDBOX_POLICY_KEYS = [
  "cpuTimeLimitMs",
  "memoryLimitBytes",
  "wallClockTimeoutMs",
  "filesystem",
  "network",
] as const;
const PYTHON_STATIC_ANALYSIS_KEYS = [
  "analyzer",
  "analyzerVersion",
  "passed",
] as const;
const PYTHON_AUDIT_METADATA_KEYS = ["eventSchemaVersion"] as const;

export type SourceDocument = Timestamped & {
  id: SourceDocumentId;
  ownerUserId: UserId;
  name: string;
  kind: SourceKind;
  currentRevisionId: SourceRevisionId | null;
  status: SourceDocumentStatus;
  deletedAt: Date | null;
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
};

export function createSourceDocument(
  input: Omit<
    SourceDocument,
    keyof Timestamped | "status" | "deletedAt" | "currentRevisionId"
  > & { currentRevisionId?: SourceRevisionId | null },
  at: Date,
): SourceDocument {
  return {
    ...input,
    createdAt: at,
    currentRevisionId: input.currentRevisionId ?? null,
    deletedAt: null,
    kind: sourceKind(input.kind),
    name: sourceDocumentName(input.name),
    status: "active",
    updatedAt: at,
  };
}

export function createSourceRevision(input: SourceRevision): SourceRevision {
  if (input.parentRevisionId === input.id) {
    throw new InvalidQuestionFieldError("source revision cannot parent itself");
  }
  const kind = sourceKind(input.kind);
  const contentType = nonEmpty(input.contentType, "contentType");
  const revision = {
    ...input,
    byteSize: positiveInteger(input.byteSize, "byteSize"),
    checksumSha256: checksumSha256(input.checksumSha256),
    contentType,
    kind,
  };
  if (kind === "python") {
    if (input.contentType !== PYTHON_SOURCE_CONTENT_TYPE) {
      throw new InvalidQuestionFieldError(
        `python source revision contentType must be ${PYTHON_SOURCE_CONTENT_TYPE}`,
      );
    }
    return {
      ...revision,
      editorMetadata: pythonSourceRevisionMetadata(input.editorMetadata),
    };
  }
  return revision;
}

export function createSourceArtifact(
  input: Omit<SourceArtifact, keyof Timestamped>,
  at: Date,
): SourceArtifact {
  const kind = sourceKind(input.kind);
  assertPythonSourceArtifactMaterializationDisabled(kind);
  assertSourceArtifactState({ ...input, kind });
  return {
    ...input,
    createdAt: at,
    kind,
    processor: nonEmpty(input.processor, "processor"),
    processorVersion: nonEmpty(input.processorVersion, "processorVersion"),
    status: sourceArtifactStatus(input.status),
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
}): SourceRevision {
  return createSourceRevision({
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
  });
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
}): SourceArtifact {
  const kind = sourceKind(input.kind);
  assertPythonSourceArtifactMaterializationDisabled(kind);
  const artifact = {
    artifactMetadata: input.artifactMetadata,
    createdAt: input.createdAt,
    id: sourceArtifactId(input.id),
    kind,
    ownerUserId: userId(input.ownerUserId),
    processor: nonEmpty(input.processor, "processor"),
    processorVersion: nonEmpty(input.processorVersion, "processorVersion"),
    sourceRevisionId: sourceRevisionId(input.sourceRevisionId),
    status: sourceArtifactStatus(input.status),
    updatedAt: input.updatedAt,
    validationError: input.validationError,
    workbookId: input.workbookId ? workbookId(input.workbookId) : null,
  };
  assertSourceArtifactState(artifact);
  return artifact;
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

export function pythonSourceRevisionMetadata(
  value: unknown,
): PythonSourceRevisionMetadata {
  if (!isJsonObject(value)) {
    throw new InvalidQuestionFieldError(
      "python source revision metadata must be an object",
    );
  }
  if (
    !hasExactKeys(value, PYTHON_REVISION_METADATA_KEYS) ||
    value.schemaVersion !== 1 ||
    value.encoding !== "utf-8" ||
    value.entrypoint !== "main.py"
  ) {
    throw new InvalidQuestionFieldError(
      "python source revision metadata must use schema version 1, UTF-8, and main.py",
    );
  }
  return {
    encoding: "utf-8",
    entrypoint: "main.py",
    schemaVersion: 1,
  };
}

export function pythonSourceArtifactMetadata(
  value: unknown,
): PythonSourceArtifactMetadata {
  if (!isJsonObject(value)) {
    throw new InvalidQuestionFieldError(
      "python source artifact metadata must be an object",
    );
  }
  const runtime = value.runtime;
  const sandboxPolicy = value.sandboxPolicy;
  const staticAnalysis = value.staticAnalysis;
  const audit = value.audit;
  if (
    !hasExactKeys(value, PYTHON_ARTIFACT_METADATA_KEYS) ||
    value.schemaVersion !== 1 ||
    !isJsonObject(runtime) ||
    !hasExactKeys(runtime, PYTHON_RUNTIME_METADATA_KEYS) ||
    runtime.implementation !== "cpython" ||
    !isExactVersion(runtime.version) ||
    !isSha256Digest(runtime.imageDigest) ||
    (runtime.dependencyLockChecksumSha256 !== null &&
      !isSha256(runtime.dependencyLockChecksumSha256)) ||
    !isJsonObject(sandboxPolicy) ||
    !hasExactKeys(sandboxPolicy, PYTHON_SANDBOX_POLICY_KEYS) ||
    !isPositiveInteger(sandboxPolicy.cpuTimeLimitMs) ||
    !isPositiveInteger(sandboxPolicy.memoryLimitBytes) ||
    !isPositiveInteger(sandboxPolicy.wallClockTimeoutMs) ||
    sandboxPolicy.filesystem !== "isolated" ||
    sandboxPolicy.network !== "disabled" ||
    !isJsonObject(staticAnalysis) ||
    !hasExactKeys(staticAnalysis, PYTHON_STATIC_ANALYSIS_KEYS) ||
    !isNonEmptyString(staticAnalysis.analyzer) ||
    !isExactVersion(staticAnalysis.analyzerVersion) ||
    typeof staticAnalysis.passed !== "boolean" ||
    !isJsonObject(audit) ||
    !hasExactKeys(audit, PYTHON_AUDIT_METADATA_KEYS) ||
    audit.eventSchemaVersion !== 1
  ) {
    throw new InvalidQuestionFieldError(
      "python source artifact metadata is invalid",
    );
  }
  return {
    audit: { eventSchemaVersion: 1 },
    runtime: {
      dependencyLockChecksumSha256: runtime.dependencyLockChecksumSha256,
      imageDigest: runtime.imageDigest,
      implementation: "cpython",
      version: runtime.version,
    },
    sandboxPolicy: {
      cpuTimeLimitMs: sandboxPolicy.cpuTimeLimitMs,
      filesystem: "isolated",
      memoryLimitBytes: sandboxPolicy.memoryLimitBytes,
      network: "disabled",
      wallClockTimeoutMs: sandboxPolicy.wallClockTimeoutMs,
    },
    schemaVersion: 1,
    staticAnalysis: {
      analyzer: staticAnalysis.analyzer,
      analyzerVersion: staticAnalysis.analyzerVersion,
      passed: staticAnalysis.passed,
    },
  };
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

function assertPythonSourceArtifactMaterializationDisabled(
  kind: SourceKind,
): void {
  // ADR 0004 keeps Python artifacts impossible to materialize in the API. A
  // future sandbox worker must replace this fail-closed boundary explicitly.
  if (kind === "python") {
    throw new InvalidQuestionFieldError(
      "python source artifact materialization is disabled",
    );
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: JsonObject,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isExactVersion(value: unknown): value is string {
  return typeof value === "string" && EXACT_VERSION_PATTERN.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
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
