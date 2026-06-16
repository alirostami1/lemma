import type { QuestionBlueprintDocument } from "../domain/index.js";

export function blueprintRequiresWorkbookSource(
  blueprint: QuestionBlueprintDocument,
): boolean {
  return blueprint.references.some(
    (reference) =>
      reference.source.type === "workbook_cell" ||
      reference.source.type === "workbook_range",
  );
}
