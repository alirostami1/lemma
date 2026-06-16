import type { EditorSelection } from "../editor-selection";
import {
  type ComposedReferenceDraft,
  type ComposedEditorModel,
  type ComposedInlineContent,
  createReferenceDraft,
  isValidReferenceId,
  normalizeReferenceId,
  renameReferenceIdInComposedEditorModel,
  updateComposedBlock,
} from "#/domains/questions/authoring";

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
  return `{{ .${referenceId} }}`;
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
  const issue = getReferenceIdIssue(model, nextReferenceId, previousReferenceId);
  if (issue) {
    return {
      status: issue.type === "invalid" ? "invalid_name" : "duplicate_name",
      message: issue.message,
    };
  }

  const normalized = normalizeReferenceId(nextReferenceId);

  return {
    status: "renamed",
    referenceId: normalized,
    model: renameReferenceIdInComposedEditorModel(
      model,
      previousReferenceId,
      normalized,
    ),
  };
}

export function getReferenceIdIssue(
  model: ComposedEditorModel,
  nextReferenceId: string,
  previousReferenceId?: string,
): { type: "invalid" | "duplicate"; message: string } | null {
  const normalized = normalizeReferenceId(nextReferenceId);

  if (!isValidReferenceId(normalized)) {
    return { type: "invalid", message: referenceIdValidationMessage };
  }

  if (
    normalized !== previousReferenceId &&
    model.references.some((reference) => reference.id === normalized)
  ) {
    return { type: "duplicate", message: referenceIdDuplicateMessage };
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
    references: model.references.filter((reference) => reference.id !== referenceId),
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
    nextContent.push({ type: "text", text: " " });
  }

  nextContent.push({ type: "reference", referenceId });

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
  return {
    ...createUniqueReferenceDraft(model),
    source,
    label,
  };
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
