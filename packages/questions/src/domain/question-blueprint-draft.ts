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
  type UserId,
  userId,
  type WorkbookId,
  workbookId,
} from "./ids.js";
import {
  questionBlueprintSourceId,
  questionBlueprintSourceIdsUsedByDocument,
  questionBlueprintSourceName,
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
  workbookId: WorkbookId | null;
  status: "local" | "uploaded" | "validated" | "invalid";
  originalName: string | null;
  byteSize: number | null;
  checksumSha256: string | null;
};

export type QuestionBlueprintDraft = Timestamped & {
  id: QuestionBlueprintDraftId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  revision: number;
  blueprintId: QuestionBlueprintId | null;
  baseVersionId: QuestionBlueprintVersionId | null;
  name: QuestionBlueprintName;
  description: QuestionBlueprintDescription | null;
  document: QuestionBlueprintDocument;
  sources: readonly QuestionBlueprintDraftSource[];
  status: QuestionBlueprintDraftStatus;
  lastSavedAt: Date;
  publishedAt: Date | null;
  discardedAt: Date | null;
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

export function questionBlueprintDraftSources(
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
      status: status as QuestionBlueprintDraftSource["status"],
      type: "workbook",
      workbookId:
        source.workbookId === null ? null : workbookId(source.workbookId),
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
  const status = draftStatus(input.status);
  assertDraftTargetBasePair({ baseVersionId, blueprintId, status });
  const document = questionBlueprintDocument(input.document);
  const sources = questionBlueprintDraftSources(input.sources);
  assertDraftReferences(document, sources);
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
            status: "uploaded",
          }
        : source,
    ),
  };
}

export function markQuestionBlueprintDraftPublished(
  draft: QuestionBlueprintDraft,
  blueprintId: QuestionBlueprintId,
  sources: readonly QuestionBlueprintDraftSource[],
  at: Date,
): QuestionBlueprintDraft {
  assertMutable(draft);
  return {
    ...touch(draft, at),
    blueprintId,
    publishedAt: at,
    revision: nextQuestionBlueprintDraftRevision(draft.revision),
    sources,
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

function nextQuestionBlueprintDraftRevision(value: number): number {
  return questionBlueprintDraftRevision(value + 1);
}

function assertDraftTargetBasePair(input: {
  blueprintId: QuestionBlueprintId | null;
  baseVersionId: QuestionBlueprintVersionId | null;
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
