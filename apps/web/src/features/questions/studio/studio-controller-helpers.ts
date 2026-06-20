import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";

export function createDraftSnapshotKey({
  blueprintId,
  blueprintName,
  description,
  sources,
  authoringModel,
}: {
  blueprintId: string;
  blueprintName: string;
  description: string;
  sources: QuestionBlueprintWorkbookSource[];
  authoringModel: ComposedEditorModel;
}) {
  return JSON.stringify({
    blueprintId,
    blueprintName,
    description,
    sources,
    authoringModel,
  });
}
