import {
  type ComposedEditorModel,
  type ComposedReferenceDraft,
  createReferenceDraft,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import { getWorkbookReferenceDisplayName } from "#/domains/questions/reference-names";

export function getReferenceDisplayName(reference: ComposedReferenceDraft) {
  const label = reference.label?.trim();
  if (label) {
    return label;
  }

  return reference.source.type === "literal"
    ? "Literal value"
    : getWorkbookReferenceDisplayName(reference.source);
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

export function getSourceDisplayName(
  source: QuestionBlueprintWorkbookSource,
): string {
  return source.name.trim().length > 0 ? source.name : "Workbook";
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
  const sourceLabel = source
    ? getSourceDisplayName(source)
    : "Missing workbook";
  return `${sourceLabel} · ${getWorkbookReferenceDisplayName(reference.source)}`;
}
