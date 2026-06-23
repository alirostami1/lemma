import {
  type ComposedEditorModel,
  type ComposedInlineContent,
  type ComposedReferenceDraft,
  createReferenceDraft,
  isValidReferenceId,
  mergeReferenceIdInComposedEditorModel,
  normalizeReferenceId,
  renameReferenceIdInComposedEditorModel,
  updateComposedBlock,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import {
  formatReferenceToken,
  getReferenceIdForSource,
  getWorkbookReferenceDisplayName,
  isCanonicalWorkbookReferenceKey,
} from "#/domains/questions/reference-names";
import type { EditorSelection } from "../editor-selection";

export type RenameReferenceResult =
  | {
      status: "renamed";
      model: ComposedEditorModel;
      referenceId: string;
    }
  | {
      status: "invalid_name";
      message: string;
    }
  | {
      status: "duplicate_name";
      message: string;
    };

export const referenceIdValidationMessage =
  "Reference id must start with a letter and use letters, numbers, underscores, or hyphens.";

export const referenceIdDuplicateMessage = "Reference id already exists.";

export function getReferenceDisplayName(reference: ComposedReferenceDraft) {
  return reference.label?.trim() || reference.id;
}

export function getReferenceSyntax(referenceId: string) {
  return formatReferenceToken(referenceId);
}

export function createUniqueReferenceDraft(
  model: ComposedEditorModel,
): ComposedReferenceDraft {
  return createReferenceDraft(model);
}

export function addReferenceToModel(
  model: ComposedEditorModel,
  reference: ComposedReferenceDraft,
): ComposedEditorModel {
  return {
    ...model,
    references: [...model.references, reference],
  };
}

export function renameReferenceInModel({
  model,
  previousReferenceId,
  nextReferenceId,
}: {
  model: ComposedEditorModel;
  previousReferenceId: string;
  nextReferenceId: string;
}): RenameReferenceResult {
  const issue = getReferenceIdIssue(
    model,
    nextReferenceId,
    previousReferenceId,
  );
  if (issue) {
    return {
      message: issue.message,
      status: issue.type === "invalid" ? "invalid_name" : "duplicate_name",
    };
  }

  const normalized = normalizeReferenceId(nextReferenceId);

  return {
    model: renameReferenceIdInComposedEditorModel(
      model,
      previousReferenceId,
      normalized,
    ),
    referenceId: normalized,
    status: "renamed",
  };
}

export function getReferenceIdIssue(
  model: ComposedEditorModel,
  nextReferenceId: string,
  previousReferenceId?: string,
): { type: "invalid" | "duplicate"; message: string } | null {
  const normalized = normalizeReferenceId(nextReferenceId);

  if (
    !isValidReferenceId(normalized) &&
    !isCanonicalWorkbookReferenceKey(normalized)
  ) {
    return { message: referenceIdValidationMessage, type: "invalid" };
  }

  if (
    normalized !== previousReferenceId &&
    model.references.some((reference) => reference.id === normalized)
  ) {
    return { message: referenceIdDuplicateMessage, type: "duplicate" };
  }

  return null;
}

export function removeUnusedReferenceFromModel({
  model,
  referenceId,
}: {
  model: ComposedEditorModel;
  referenceId: string;
}): ComposedEditorModel {
  return {
    ...model,
    references: model.references.filter(
      (reference) => reference.id !== referenceId,
    ),
  };
}

export function appendReferenceToInlineContent(
  content: ComposedInlineContent[],
  referenceId: string,
): ComposedInlineContent[] {
  const nextContent = [...content];

  const previous = nextContent.at(-1);
  if (
    nextContent.length > 0 &&
    previous?.type === "text" &&
    previous.text.length > 0 &&
    !/\s$/u.test(previous.text)
  ) {
    nextContent[nextContent.length - 1] = {
      ...previous,
      text: `${previous.text} `,
    };
  } else if (nextContent.length > 0 && previous?.type !== "text") {
    nextContent.push({ text: " ", type: "text" });
  }

  nextContent.push({ referenceId, type: "reference" });

  return nextContent;
}

export function addReferenceAndInsertIntoTextBlock({
  model,
  blockId,
  reference,
}: {
  model: ComposedEditorModel;
  blockId: string;
  reference: ComposedReferenceDraft;
}): ComposedEditorModel {
  return updateComposedBlock(
    addReferenceToModel(model, reference),
    blockId,
    (currentBlock) => {
      if (currentBlock.type !== "text") {
        return currentBlock;
      }

      return {
        ...currentBlock,
        content: appendReferenceToInlineContent(
          currentBlock.content,
          reference.id,
        ),
      };
    },
  );
}

export function createReferenceDraftFromSource({
  model,
  source,
  label,
}: {
  model: ComposedEditorModel;
  source: ComposedReferenceDraft["source"];
  label?: string;
}): ComposedReferenceDraft {
  const workbookReferenceId = getReferenceIdForSource(source);

  return {
    ...(workbookReferenceId
      ? {
          id: workbookReferenceId,
          source,
        }
      : createUniqueReferenceDraft(model)),
    label,
    source,
  };
}

export function mergeReferenceIntoExistingModel({
  model,
  previousReferenceId,
  nextReferenceId,
}: {
  model: ComposedEditorModel;
  previousReferenceId: string;
  nextReferenceId: string;
}): ComposedEditorModel {
  return mergeReferenceIdInComposedEditorModel(
    model,
    previousReferenceId,
    nextReferenceId,
  );
}

export function insertReferenceIntoSelectedTextBlock({
  model,
  selection,
  referenceId,
}: {
  model: ComposedEditorModel;
  selection: EditorSelection;
  referenceId: string;
}): ComposedEditorModel | null {
  if (selection.type !== "block") {
    return null;
  }

  return updateComposedBlock(model, selection.blockId, (block) => {
    if (block.type !== "text") {
      return block;
    }

    return {
      ...block,
      content: appendReferenceToInlineContent(block.content, referenceId),
    };
  });
}

export function getReferenceSourceLabel(reference: ComposedReferenceDraft) {
  if (reference.source.type === "literal") {
    return "Literal value";
  }

  if (reference.source.type === "workbook_cell") {
    return "Workbook cell";
  }

  if (reference.source.type === "workbook_range") {
    return "Workbook range";
  }

  return "Source";
}

export function getSourceDisplayName(
  source: QuestionBlueprintWorkbookSource,
): string {
  return source.name.trim().length > 0 ? source.name : source.workbookId;
}

export function getReferenceSourceSummary(
  reference: ComposedReferenceDraft,
  sources: QuestionBlueprintWorkbookSource[],
): string {
  if (reference.source.type === "literal") {
    return "Literal value";
  }
  const sourceId = reference.source.sourceId;

  const source = sources.find((candidate) => candidate.sourceId === sourceId);
  const sourceLabel = source ? getSourceDisplayName(source) : "Missing source";
  return `${sourceLabel} · ${getWorkbookReferenceDisplayName(reference.source)}`;
}
