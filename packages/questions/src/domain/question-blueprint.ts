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
  type QuestionBlueprintDocument,
  questionBlueprintDocument,
} from "./question-blueprint-document.js";
import type { QuestionReferenceSource } from "./question-reference.js";
import {
  type QuestionBlueprintDescription,
  type QuestionBlueprintName,
  type QuestionBlueprintStatus,
  type QuestionBlueprintVisibility,
  questionBlueprintDescription,
  questionBlueprintName,
  questionBlueprintStatus,
  questionBlueprintVisibility,
} from "./question-values.js";

export type QuestionBlueprint = Timestamped & {
  id: QuestionBlueprintId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  name: QuestionBlueprintName;
  description: QuestionBlueprintDescription | null;
  visibility: QuestionBlueprintVisibility;
  sources: QuestionBlueprintSource[];
  currentVersionId: QuestionBlueprintVersionId | null;
  status: QuestionBlueprintStatus;
  archivedAt: Date | null;
};

export type QuestionBlueprintVersion = {
  id: QuestionBlueprintVersionId;
  questionBlueprintId: QuestionBlueprintId;
  versionNumber: number;
  document: QuestionBlueprintDocument;
  sources: QuestionBlueprintSource[];
  createdByUserId: UserId;
  createdAt: Date;
};

export type QuestionBlueprintVersionAsset = {
  questionBlueprintVersionId: QuestionBlueprintVersionId;
  workbookId: WorkbookId;
  kind: "workbook";
  position: number;
  createdAt: Date;
};

export function createQuestionBlueprintVersionAssets(
  input: {
    questionBlueprintVersionId: QuestionBlueprintVersionId;
    sources: readonly QuestionBlueprintSource[];
  },
  at: Date,
): QuestionBlueprintVersionAsset[] {
  return input.sources.flatMap((source, index) => {
    if (source.type !== "workbook") {
      return [];
    }
    return [
      {
        questionBlueprintVersionId: input.questionBlueprintVersionId,
        workbookId: source.workbookId,
        kind: "workbook" as const,
        position: index,
        createdAt: at,
      },
    ];
  });
}

export type QuestionBlueprintSource = {
  type: "workbook";
  sourceId: string;
  name: string;
  workbookId: WorkbookId;
};

export function createQuestionBlueprint(
  input: {
    id: QuestionBlueprintId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    name: QuestionBlueprintName;
    description: QuestionBlueprintDescription | null;
    sources: QuestionBlueprintSource[];
    visibility?: QuestionBlueprintVisibility;
  },
  at: Date,
): QuestionBlueprint {
  return {
    id: input.id,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    name: input.name,
    description: input.description,
    visibility: input.visibility ?? "private",
    sources: input.sources,
    currentVersionId: null,
    status: "active",
    archivedAt: null,
    createdAt: at,
    updatedAt: at,
  };
}

export function createQuestionBlueprintVersion(
  input: {
    id: QuestionBlueprintVersionId;
    questionBlueprintId: QuestionBlueprintId;
    versionNumber: number;
    document: QuestionBlueprintDocument;
    sources: QuestionBlueprintSource[];
    createdByUserId: UserId;
  },
  at: Date,
): QuestionBlueprintVersion {
  assertPositiveVersionNumber(input.versionNumber);
  return {
    id: input.id,
    questionBlueprintId: input.questionBlueprintId,
    versionNumber: input.versionNumber,
    document: input.document,
    sources: input.sources,
    createdByUserId: input.createdByUserId,
    createdAt: at,
  };
}

export function reconstituteQuestionBlueprint(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  visibility?: string;
  sources: unknown;
  currentVersionId: string | null;
  status: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): QuestionBlueprint {
  return {
    id: questionBlueprintId(input.id),
    ownerUserId: userId(input.ownerUserId),
    createdByUserId: userId(input.createdByUserId),
    name: questionBlueprintName(input.name),
    description: questionBlueprintDescription(input.description),
    visibility: questionBlueprintVisibility(input.visibility ?? "private"),
    sources: questionBlueprintSourcesOrEmpty(input.sources),
    currentVersionId:
      input.currentVersionId === null
        ? null
        : questionBlueprintVersionId(input.currentVersionId),
    status: questionBlueprintStatus(input.status),
    archivedAt: input.archivedAt,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function reconstituteQuestionBlueprintVersion(input: {
  id: string;
  questionBlueprintId: string;
  versionNumber: number;
  document: unknown;
  sources: unknown;
  createdByUserId: string;
  createdAt: Date;
}): QuestionBlueprintVersion {
  assertPositiveVersionNumber(input.versionNumber);
  return {
    id: questionBlueprintVersionId(input.id),
    questionBlueprintId: questionBlueprintId(input.questionBlueprintId),
    versionNumber: input.versionNumber,
    document: questionBlueprintDocument(input.document),
    sources: questionBlueprintSourcesOrEmpty(input.sources),
    createdByUserId: userId(input.createdByUserId),
    createdAt: input.createdAt,
  };
}

export function reconstituteQuestionBlueprintVersionAsset(input: {
  questionBlueprintVersionId: string;
  workbookId: string;
  kind: string;
  position: number;
  createdAt: Date;
}): QuestionBlueprintVersionAsset {
  if (input.kind !== "workbook") {
    throw new InvalidQuestionFieldError(
      "question blueprint version asset kind must be workbook",
    );
  }
  if (!Number.isInteger(input.position) || input.position < 0) {
    throw new InvalidQuestionFieldError(
      "question blueprint version asset position must be a non-negative integer",
    );
  }
  return {
    questionBlueprintVersionId: questionBlueprintVersionId(
      input.questionBlueprintVersionId,
    ),
    workbookId: workbookId(input.workbookId),
    kind: "workbook",
    position: input.position,
    createdAt: input.createdAt,
  };
}

export function questionBlueprintSources(
  input: unknown,
): QuestionBlueprintSource[] {
  if (input === undefined || input === null) {
    throw new InvalidQuestionFieldError(
      "question blueprint sources must be an array",
    );
  }
  if (!Array.isArray(input)) {
    throw new InvalidQuestionFieldError("question blueprint sources must be an array");
  }
  const sourceIds = new Set<string>();
  return input.map((source) => {
    if (typeof source !== "object" || source === null) {
      throw new InvalidQuestionFieldError("question blueprint source must be an object");
    }
    const record = source as Record<string, unknown>;
    if (record.type !== "workbook") {
      throw new InvalidQuestionFieldError(
        "question blueprint source type is invalid",
      );
    }
    const sourceId = questionBlueprintSourceId(record.sourceId);
    if (sourceIds.has(sourceId)) {
      throw new InvalidQuestionFieldError(
        "question blueprint source ids must be unique",
      );
    }
    sourceIds.add(sourceId);
    return {
      type: "workbook" as const,
      sourceId,
      name: questionBlueprintSourceName(record.name),
      workbookId: workbookId(record.workbookId),
    };
  });
}

export function questionBlueprintSourcesOrEmpty(
  input: unknown,
): QuestionBlueprintSource[] {
  if (input === undefined || input === null) {
    // Legacy rows may not have persisted blueprint-local sources yet.
    return [];
  }
  return questionBlueprintSources(input);
}

export function questionBlueprintSourceId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(value)) {
    throw new InvalidQuestionFieldError(
      "question blueprint source id must start with a letter and contain only letters, numbers, underscores, or hyphens",
    );
  }
  return value;
}

export function questionBlueprintSourceName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidQuestionFieldError(
      "question blueprint source name must be a non-empty string",
    );
  }
  return value.trim();
}

export function questionBlueprintSourceIdsUsedByDocument(
  document: QuestionBlueprintDocument,
): string[] {
  const sourceIds = new Set<string>();
  const orderedSourceIds: string[] = [];
  for (const reference of document.references) {
    if (isWorkbookReferenceSource(reference.source)) {
      if (!sourceIds.has(reference.source.sourceId)) {
        sourceIds.add(reference.source.sourceId);
        orderedSourceIds.push(reference.source.sourceId);
      }
    }
  }
  return orderedSourceIds;
}

export function questionBlueprintSourcesReferencedByDocument(
  document: QuestionBlueprintDocument,
  sources: readonly QuestionBlueprintSource[],
): QuestionBlueprintSource[] {
  const sourceIds = questionBlueprintSourceIdsUsedByDocument(document);
  if (sourceIds.length === 0) {
    return [];
  }
  const sourcesById = new Map(sources.map((source) => [source.sourceId, source]));
  return sourceIds.map((sourceId) => {
    const source = sourcesById.get(sourceId);
    if (!source) {
      throw new InvalidQuestionFieldError(
        `question blueprint source ${sourceId} is not attached to this blueprint`,
      );
    }
    return source;
  });
}

function isWorkbookReferenceSource(
  source: QuestionReferenceSource,
): source is Extract<QuestionReferenceSource, { sourceId: string }> {
  return source.type === "workbook_cell" || source.type === "workbook_range";
}

function assertPositiveVersionNumber(versionNumber: number): void {
  if (!Number.isInteger(versionNumber) || versionNumber <= 0) {
    throw new InvalidQuestionFieldError(
      "question blueprint version number must be a positive integer",
    );
  }
}

export function updateQuestionBlueprintMetadata(
  blueprint: QuestionBlueprint,
  patch: {
    name?: string;
    description?: string | null;
    visibility?: QuestionBlueprintVisibility;
    status?: QuestionBlueprintStatus;
  },
  at: Date,
): QuestionBlueprint {
  assertQuestionBlueprintCanChange(blueprint);
  const status =
    patch.status !== undefined
      ? questionBlueprintStatus(patch.status)
      : blueprint.status;
  return {
    ...touch(blueprint, at),
    name:
      patch.name !== undefined
        ? questionBlueprintName(patch.name)
        : blueprint.name,
    description:
      patch.description !== undefined
        ? questionBlueprintDescription(patch.description)
        : blueprint.description,
    visibility:
      patch.visibility !== undefined
        ? questionBlueprintVisibility(patch.visibility)
        : blueprint.visibility,
    status,
    archivedAt: status === "archived" ? (blueprint.archivedAt ?? at) : null,
  };
}

export function archiveQuestionBlueprint(
  blueprint: QuestionBlueprint,
  at: Date,
): QuestionBlueprint {
  assertQuestionBlueprintCanChange(blueprint);
  return { ...touch(blueprint, at), status: "archived", archivedAt: at };
}

export function deleteQuestionBlueprint(
  blueprint: QuestionBlueprint,
  at: Date,
): QuestionBlueprint {
  assertQuestionBlueprintCanChange(blueprint);
  return { ...touch(blueprint, at), status: "deleted", archivedAt: null };
}

function assertQuestionBlueprintCanChange(blueprint: QuestionBlueprint): void {
  if (blueprint.status === "deleted") {
    throw new InvalidQuestionStateTransitionError(
      "deleted question blueprints cannot be changed",
    );
  }
}
