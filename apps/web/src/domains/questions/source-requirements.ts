import {
  type ComposedEditorModel,
  extractWorkbookReferenceRefsFromComposedEditorModel,
} from "#/domains/questions/authoring";

export type BlueprintSourceRequirement =
  | {
      status: "not_required";
      workbookRefs: string[];
    }
  | {
      status: "required";
      workbookRefs: string[];
    };

export function getBlueprintSourceRequirement(
  model: ComposedEditorModel,
): BlueprintSourceRequirement {
  const workbookRefs =
    extractWorkbookReferenceRefsFromComposedEditorModel(model);

  return workbookRefs.length === 0
    ? { status: "not_required", workbookRefs }
    : { status: "required", workbookRefs };
}
