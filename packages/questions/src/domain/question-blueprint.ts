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
  currentVersionId: QuestionBlueprintVersionId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  name: QuestionBlueprintName;
  description: QuestionBlueprintDescription | null;
  document: QuestionBlueprintDocument;
  visibility: QuestionBlueprintVisibility;
  sources: readonly QuestionBlueprintSource[];
  status: QuestionBlueprintStatus;
  archivedAt: Date | null;
};

export type QuestionBlueprintSource = {
  type: "workbook";
  sourceId: string;
  name: string;
  workbookId: WorkbookId;
};

export function createQuestionBlueprint(
  input: {
    id: QuestionBlueprintId;
    currentVersionId: QuestionBlueprintVersionId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    name: QuestionBlueprintName;
    description: QuestionBlueprintDescription | null;
    document: QuestionBlueprintDocument;
    sources: readonly QuestionBlueprintSource[];
    visibility: QuestionBlueprintVisibility;
  },
  at: Date,
): QuestionBlueprint {
  const sources = questionBlueprintSources(input.sources);
  questionBlueprintSourcesReferencedByDocument(input.document, sources);
  return {
    archivedAt: null,
    createdAt: at,
    createdByUserId: input.createdByUserId,
    currentVersionId: input.currentVersionId,
    description: input.description,
    document: input.document,
    id: input.id,
    name: input.name,
    ownerUserId: input.ownerUserId,
    sources,
    status: "active",
    updatedAt: at,
    visibility: input.visibility,
  };
}

export function reconstituteQuestionBlueprint(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  currentVersionId: string;
  name: string;
  description: string | null;
  document: unknown;
  visibility: string;
  sources: unknown;
  status: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): QuestionBlueprint {
  const document = questionBlueprintDocument(input.document);
  const sources = questionBlueprintSources(input.sources);
  questionBlueprintSourcesReferencedByDocument(document, sources);
  return {
    archivedAt: input.archivedAt,
    createdAt: input.createdAt,
    createdByUserId: userId(input.createdByUserId),
    currentVersionId: questionBlueprintVersionId(input.currentVersionId),
    description: questionBlueprintDescription(input.description),
    document,
    id: questionBlueprintId(input.id),
    name: questionBlueprintName(input.name),
    ownerUserId: userId(input.ownerUserId),
    sources,
    status: questionBlueprintStatus(input.status),
    updatedAt: input.updatedAt,
    visibility: questionBlueprintVisibility(input.visibility),
  };
}

export function questionBlueprintSources(
  input: unknown,
): QuestionBlueprintSource[] {
  if (!Array.isArray(input)) {
    throw new InvalidQuestionFieldError(
      "question blueprint sources must be an array",
    );
  }
  const sourceIds = new Set<string>();
  return input.map((source) => {
    if (typeof source !== "object" || source === null) {
      throw new InvalidQuestionFieldError(
        "question blueprint source must be an object",
      );
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
      name: questionBlueprintSourceName(record.name),
      sourceId,
      type: "workbook" as const,
      workbookId: workbookId(record.workbookId),
    };
  });
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
  const sourcesById = new Map(
    sources.map((source) => [source.sourceId, source]),
  );
  return sourceIds.map((sourceId) => {
    const source = sourcesById.get(sourceId);
    if (!source) {
      throw new InvalidQuestionFieldError(
        `unknown question blueprint source id ${sourceId} is not attached to this blueprint`,
      );
    }
    return source;
  });
}

export function nextUntitledQuestionBlueprintName(
  existingNames: Iterable<string>,
): QuestionBlueprintName {
  const existing = new Set(existingNames);
  let candidate = "Untitled blueprint";
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `Untitled blueprint ${suffix}`;
    suffix += 1;
  }
  return questionBlueprintName(candidate);
}

export function updateQuestionBlueprintDefinition(
  blueprint: QuestionBlueprint,
  input: {
    document: QuestionBlueprintDocument;
    sources: readonly QuestionBlueprintSource[];
  },
  at: Date,
): QuestionBlueprint {
  assertQuestionBlueprintCanChange(blueprint);
  questionBlueprintSourcesReferencedByDocument(input.document, input.sources);
  return {
    ...touch(blueprint, at),
    document: input.document,
    sources: input.sources,
  };
}

function isWorkbookReferenceSource(
  source: QuestionReferenceSource,
): source is Extract<QuestionReferenceSource, { sourceId: string }> {
  return source.type === "workbook_cell" || source.type === "workbook_range";
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
    archivedAt: status === "archived" ? (blueprint.archivedAt ?? at) : null,
    description:
      patch.description !== undefined
        ? questionBlueprintDescription(patch.description)
        : blueprint.description,
    name:
      patch.name !== undefined
        ? questionBlueprintName(patch.name)
        : blueprint.name,
    status,
    visibility:
      patch.visibility !== undefined
        ? questionBlueprintVisibility(patch.visibility)
        : blueprint.visibility,
  };
}

export function archiveQuestionBlueprint(
  blueprint: QuestionBlueprint,
  at: Date,
): QuestionBlueprint {
  assertQuestionBlueprintCanChange(blueprint);
  return { ...touch(blueprint, at), archivedAt: at, status: "archived" };
}

export function deleteQuestionBlueprint(
  blueprint: QuestionBlueprint,
  at: Date,
): QuestionBlueprint {
  assertQuestionBlueprintCanChange(blueprint);
  return { ...touch(blueprint, at), archivedAt: null, status: "deleted" };
}

function assertQuestionBlueprintCanChange(blueprint: QuestionBlueprint): void {
  if (blueprint.status === "deleted") {
    throw new InvalidQuestionStateTransitionError(
      "deleted question blueprints cannot be changed",
    );
  }
}
