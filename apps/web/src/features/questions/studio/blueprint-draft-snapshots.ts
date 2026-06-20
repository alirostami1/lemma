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
}): { ok: true; value: LoadedBlueprintDraftSnapshotState } | { ok: false } {
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
    loadedBlueprintVersionId: input.blueprint.selectedVersionId ?? null,
  });
  const blueprintVersionId = input.blueprint.selectedVersionId ?? null;
  const blueprintDescription = input.blueprint.description ?? "";
  const remoteSnapshotKey = createDraftSnapshotKey({
    blueprintId: input.blueprintId,
    blueprintName: input.blueprint.name.trim(),
    description: blueprintDescription,
    sources: input.blueprint.sources,
    authoringModel,
  });
  const syncedSnapshot = createStudioDraftSnapshot({
    draftKey: draftStorageKey,
    loadedBlueprintId: input.blueprintId,
    loadedBlueprintVersionId: blueprintVersionId,
    sources: input.blueprint.sources,
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
  });
  const snapshot = createStudioDraftSnapshot({
    draftKey: draftStorageKey,
    loadedBlueprintId: null,
    loadedBlueprintVersionId: null,
    sources: [],
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
  sources: QuestionBlueprintAuthoring["sources"];
}) {
  const remoteSnapshotKey = createDraftSnapshotKey({
    blueprintId: input.blueprintId,
    blueprintName: input.blueprintName.trim(),
    description: input.blueprintDescription,
    sources: input.sources,
    authoringModel: input.authoringModel,
  });
  const draftKey = createStudioDraftKey({
    loadedBlueprintId: input.blueprintId,
    loadedBlueprintVersionId: input.blueprintVersionId ?? null,
  });
  const syncedSnapshot = createStudioDraftSnapshot({
    draftKey,
    loadedBlueprintId: input.blueprintId,
    loadedBlueprintVersionId: input.blueprintVersionId ?? null,
    sources: input.sources,
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
