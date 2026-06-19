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
  workbookId: WorkbookId | null;
  workbookSources: QuestionBlueprintWorkbookSource[];
  currentVersionId: QuestionBlueprintVersionId | null;
  status: QuestionBlueprintStatus;
  archivedAt: Date | null;
};

export type QuestionBlueprintVersion = {
  id: QuestionBlueprintVersionId;
  questionBlueprintId: QuestionBlueprintId;
  versionNumber: number;
  document: QuestionBlueprintDocument;
  workbookId: WorkbookId | null;
  workbookSources: QuestionBlueprintWorkbookSource[];
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
    workbookIds: readonly WorkbookId[];
  },
  at: Date,
): QuestionBlueprintVersionAsset[] {
  return input.workbookIds.map((id, index) => ({
    questionBlueprintVersionId: input.questionBlueprintVersionId,
    workbookId: id,
    kind: "workbook",
    position: index,
    createdAt: at,
  }));
}

export type QuestionBlueprintWorkbookSource = {
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
    workbookId?: WorkbookId | null;
    workbookSources?: QuestionBlueprintWorkbookSource[];
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
    workbookId: input.workbookId ?? null,
    workbookSources: input.workbookSources ?? [],
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
    workbookId?: string | null;
    workbookSources?: QuestionBlueprintWorkbookSource[];
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
    workbookId:
      input.workbookId === undefined || input.workbookId === null
        ? null
        : workbookId(input.workbookId),
    workbookSources: input.workbookSources ?? [],
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
  workbookId: string | null;
  workbookSources?: unknown;
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
    workbookId: input.workbookId === null ? null : workbookId(input.workbookId),
    workbookSources: questionBlueprintWorkbookSources(input.workbookSources),
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
  workbookId: string | null;
  workbookSources?: unknown;
  createdByUserId: string;
  createdAt: Date;
}): QuestionBlueprintVersion {
  assertPositiveVersionNumber(input.versionNumber);
  return {
    id: questionBlueprintVersionId(input.id),
    questionBlueprintId: questionBlueprintId(input.questionBlueprintId),
    versionNumber: input.versionNumber,
    document: questionBlueprintDocument(input.document),
    workbookId: input.workbookId === null ? null : workbookId(input.workbookId),
    workbookSources: questionBlueprintWorkbookSources(input.workbookSources),
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

export function questionBlueprintWorkbookSources(
  input: unknown,
): QuestionBlueprintWorkbookSource[] {
  if (input === undefined || input === null) {
    return [];
  }
  if (!Array.isArray(input)) {
    throw new InvalidQuestionFieldError(
      "question blueprint workbook sources must be an array",
    );
  }
  const sourceIds = new Set<string>();
  return input.map((source) => {
    if (typeof source !== "object" || source === null) {
      throw new InvalidQuestionFieldError(
        "question blueprint workbook source must be an object",
      );
    }
    const record = source as Record<string, unknown>;
    const sourceId = questionBlueprintWorkbookSourceId(record.sourceId);
    if (sourceIds.has(sourceId)) {
      throw new InvalidQuestionFieldError(
        "question blueprint workbook source ids must be unique",
      );
    }
    sourceIds.add(sourceId);
    return {
      sourceId,
      name: questionBlueprintWorkbookSourceName(record.name),
      workbookId: workbookId(record.workbookId),
    };
  });
}

export function questionBlueprintWorkbookSourceId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(value)) {
    throw new InvalidQuestionFieldError(
      "question blueprint workbook source id must start with a letter and contain only letters, numbers, underscores, or hyphens",
    );
  }
  return value;
}

export function questionBlueprintWorkbookSourceName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidQuestionFieldError(
      "question blueprint workbook source name must be a non-empty string",
    );
  }
  return value.trim();
}

export function workbookSourceIdsUsedByDocument(
  document: QuestionBlueprintDocument,
): Set<string> {
  const sourceIds = new Set<string>();
  for (const reference of document.references) {
    if (isWorkbookReferenceSource(reference.source)) {
      sourceIds.add(reference.source.sourceId);
    }
  }
  return sourceIds;
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
