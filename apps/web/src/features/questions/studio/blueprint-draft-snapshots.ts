import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { createDefaultComposedEditorModel } from "#/domains/questions/authoring";
import { questionBlueprintDocumentToComposedEditorModel } from "#/domains/questions/canonical-authoring";
import type { QuestionBlueprintAuthoring } from "#/domains/questions/model";
import { createDraftSnapshotKey } from "./studio-controller-helpers";
import {
  createStudioDraftKey,
  createStudioDraftSnapshot,
} from "./studio-draft-store";
import { createDraftKeyFromSnapshot } from "./studio-state";

export type LoadedBlueprintDraftSnapshotState = {
  authoringModel: ComposedEditorModel;
  blueprintVersionId: string | null;
  draftStorageKey: string;
  remoteSnapshotKey: string;
  syncedSnapshot: ReturnType<typeof createStudioDraftSnapshot>;
};

export function createLoadedBlueprintDraftSnapshotState(input: {
  blueprint: QuestionBlueprintAuthoring;
  blueprintId: string;
  initialWorkbookId: string;
}):
  | { ok: true; value: LoadedBlueprintDraftSnapshotState }
  | { ok: false } {
  let authoringModel: ComposedEditorModel;
  try {
    authoringModel = questionBlueprintDocumentToComposedEditorModel(
      input.blueprint.document,
    );
  } catch {
    return { ok: false };
  }

  const draftStorageKey = createStudioDraftKey({
    loadedBlueprintId: input.blueprintId,
    initialWorkbookId: input.initialWorkbookId,
  });
  const blueprintVersionId = input.blueprint.currentVersionId ?? null;
  const selectedWorkbookId = input.blueprint.workbookId ?? "";
  const blueprintDescription = input.blueprint.description ?? "";
  const remoteSnapshotKey = createDraftSnapshotKey({
    blueprintId: input.blueprintId,
    blueprintName: input.blueprint.name.trim(),
    description: blueprintDescription,
    workbookId: selectedWorkbookId,
    authoringModel,
  });
  const syncedSnapshot = createStudioDraftSnapshot({
    draftKey: draftStorageKey,
    loadedBlueprintId: input.blueprintId,
    loadedBlueprintVersionId: blueprintVersionId,
    selectedWorkbookId,
    blueprintName: input.blueprint.name,
    blueprintDescription,
    authoringModel,
    lastRemoteSaveSnapshotKey: remoteSnapshotKey,
  });

  return {
    ok: true,
    value: {
      authoringModel,
      blueprintVersionId,
      draftStorageKey,
      remoteSnapshotKey,
      syncedSnapshot,
    },
  };
}

export function createResetStudioDraftSnapshotState() {
  const authoringModel = createDefaultComposedEditorModel();
  const draftStorageKey = createStudioDraftKey({
    loadedBlueprintId: null,
    initialWorkbookId: "",
  });
  const snapshot = createStudioDraftSnapshot({
    draftKey: draftStorageKey,
    loadedBlueprintId: null,
    loadedBlueprintVersionId: null,
    selectedWorkbookId: "",
    blueprintName: "Question blueprint",
    blueprintDescription: "",
    authoringModel,
    lastRemoteSaveSnapshotKey: null,
  });

  return {
    authoringModel,
    draftKey: createDraftKeyFromSnapshot(snapshot),
    draftStorageKey,
    snapshot,
  };
}

export function createSavedBlueprintDraftSnapshotState(input: {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintId: string;
  blueprintName: string;
  blueprintVersionId?: string | null;
  initialWorkbookId: string;
  workbookId: string;
}) {
  const remoteSnapshotKey = createDraftSnapshotKey({
    blueprintId: input.blueprintId,
    blueprintName: input.blueprintName.trim(),
    description: input.blueprintDescription,
    workbookId: input.workbookId,
    authoringModel: input.authoringModel,
  });
  const draftKey = createStudioDraftKey({
    loadedBlueprintId: input.blueprintId,
    initialWorkbookId: input.initialWorkbookId,
  });
  const syncedSnapshot = createStudioDraftSnapshot({
    draftKey,
    loadedBlueprintId: input.blueprintId,
    loadedBlueprintVersionId: input.blueprintVersionId ?? null,
    selectedWorkbookId: input.workbookId,
    blueprintName: input.blueprintName,
    blueprintDescription: input.blueprintDescription,
    authoringModel: input.authoringModel,
    lastRemoteSaveSnapshotKey: remoteSnapshotKey,
  });

  return {
    draftKey,
    remoteSnapshotKey,
    syncedSnapshot,
  };
}
