import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { createDefaultComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioSource } from "./source/studio-source-model";
import { createDraftSnapshotKey } from "./studio-controller-helpers";
import {
  createStudioDraftKey,
  createStudioDraftSnapshot,
} from "./studio-draft-store";
import { createDraftKeyFromSnapshot } from "./studio-state";

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
  blueprintId: string | null;
  blueprintName: string;
  sources: StudioSource[];
}) {
  const remoteSnapshotKey = createDraftSnapshotKey({
    authoringModel: input.authoringModel,
    blueprintId: input.blueprintId ?? "",
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
