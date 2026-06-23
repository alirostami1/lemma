import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { createDefaultComposedEditorModel } from "#/domains/questions/authoring";
import { questionBlueprintDocumentToComposedEditorModel } from "#/domains/questions/canonical-authoring";
import type { QuestionBlueprintAuthoring } from "#/domains/questions/model";
import {
  type StudioSource,
  toStudioSourcesFromSavedBlueprint,
} from "./source/studio-source-model";
import { createDraftSnapshotKey } from "./studio-controller-helpers";
import {
  createStudioDraftKey,
  createStudioDraftSnapshot,
} from "./studio-draft-store";
import { createDraftKeyFromSnapshot } from "./studio-state";

export type LoadedBlueprintDraftSnapshotState = {
  authoringModel: ComposedEditorModel;
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
  });
  const blueprintDescription = input.blueprint.description ?? "";
  const studioSources = toStudioSourcesFromSavedBlueprint(
    input.blueprint.sources,
  );
  const remoteSnapshotKey = createDraftSnapshotKey({
    authoringModel,
    blueprintId: input.blueprintId,
    blueprintName: input.blueprint.name.trim(),
    description: blueprintDescription,
    sources: studioSources,
  });
  const syncedSnapshot = createStudioDraftSnapshot({
    authoringModel,
    blueprintDescription,
    blueprintName: input.blueprint.name,
    draftKey: draftStorageKey,
    lastRemoteSaveSnapshotKey: remoteSnapshotKey,
    loadedBlueprintId: input.blueprintId,
    sources: studioSources,
  });

  return {
    ok: true,
    value: {
      authoringModel,
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
    authoringModel,
    blueprintDescription: "",
    blueprintName: "Question blueprint",
    draftKey: draftStorageKey,
    lastRemoteSaveSnapshotKey: null,
    loadedBlueprintId: null,
    sources: [],
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
  sources: StudioSource[];
}) {
  const remoteSnapshotKey = createDraftSnapshotKey({
    authoringModel: input.authoringModel,
    blueprintId: input.blueprintId,
    blueprintName: input.blueprintName.trim(),
    description: input.blueprintDescription,
    sources: input.sources,
  });
  const draftKey = createStudioDraftKey({
    loadedBlueprintId: input.blueprintId,
  });
  const syncedSnapshot = createStudioDraftSnapshot({
    authoringModel: input.authoringModel,
    blueprintDescription: input.blueprintDescription,
    blueprintName: input.blueprintName,
    draftKey,
    lastRemoteSaveSnapshotKey: remoteSnapshotKey,
    loadedBlueprintId: input.blueprintId,
    sources: input.sources,
  });

  return {
    draftKey,
    remoteSnapshotKey,
    syncedSnapshot,
  };
}
