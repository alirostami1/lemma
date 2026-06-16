import type { ComposedEditorModel } from "#/domains/questions/authoring";

export function createDraftSnapshotKey({
  blueprintId,
  blueprintName,
  description,
  workbookId,
  authoringModel,
}: {
  blueprintId: string;
  blueprintName: string;
  description: string;
  workbookId: string;
  authoringModel: ComposedEditorModel;
}) {
  return JSON.stringify({
    blueprintId,
    blueprintName,
    description,
    workbookId,
    authoringModel,
  });
}
