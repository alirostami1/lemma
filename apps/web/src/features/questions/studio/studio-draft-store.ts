import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  deserializeStudioSources,
  type SerializableStudioSource,
  type StudioSource,
  serializeStudioSources,
} from "./source/studio-source-model";
import { saveStudioDraftWorkbookFile } from "./studio-draft-assets-store";

const STORAGE_PREFIX = "lemma:studio-draft:v1:";
const STORAGE_INDEX_KEY = "lemma:studio-draft:index:v1";
const SNAPSHOT_SCHEMA_VERSION = 2;
const MAX_DRAFTS = 20;
const MAX_DRAFT_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export type StudioDraftKeyInput = {
  loadedBlueprintId: string | null;
};

export type StudioDraftSnapshot = {
  schemaVersion: 2;
  draftKey: string;
  loadedBlueprintId: string | null;
  sources: StudioSource[];
  blueprintName: string;
  blueprintDescription: string;
  authoringModel: ComposedEditorModel;
  lastLocalSaveTimestamp: number;
  lastRemoteSaveSnapshotKey: string | null;
};

type SerializedStudioDraftSnapshot = Omit<StudioDraftSnapshot, "sources"> & {
  sources: SerializableStudioSource[];
};

export type StudioDraftStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: "storage_unavailable" | "invalid_snapshot" };

export type StudioDraftSnapshotWithAssetsResult =
  | {
      ok: true;
      value: StudioDraftSnapshot;
      assets: { status: "safe" };
    }
  | {
      ok: true;
      value: StudioDraftSnapshot;
      assets: {
        status: "unsafe";
        unsafeSourceIds: readonly string[];
        error: "asset_write_failed" | "indexeddb_unavailable";
      };
    }
  | {
      ok: false;
      error: "storage_unavailable" | "invalid_snapshot";
    };

export function createStudioDraftKey({
  loadedBlueprintId,
}: StudioDraftKeyInput) {
  if (loadedBlueprintId) {
    return `blueprint:${loadedBlueprintId}`;
  }

  return "new:default";
}

export function readStudioDraftSnapshot(
  draftKey: string,
): StudioDraftStoreResult<StudioDraftSnapshot | null> {
  const storage = getStorage();
  if (!storage) return { error: "storage_unavailable", ok: false };

  const storageKey = getStorageKey(draftKey);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return { ok: true, value: null };

    const parsed = JSON.parse(raw);
    if (!isStudioDraftSnapshot(parsed) || parsed.draftKey !== draftKey) {
      storage.removeItem(storageKey);
      removeIndexEntry(storage, draftKey);
      return { error: "invalid_snapshot", ok: false };
    }

    return {
      ok: true,
      value: {
        ...parsed,
        sources: deserializeStudioSources(parsed.sources),
      },
    };
  } catch {
    try {
      storage.removeItem(storageKey);
      removeIndexEntry(storage, draftKey);
    } catch {
      return { error: "storage_unavailable", ok: false };
    }
    return { error: "invalid_snapshot", ok: false };
  }
}

export function readLatestStudioDraftSnapshot(): StudioDraftStoreResult<StudioDraftSnapshot | null> {
  const storage = getStorage();
  if (!storage) return { error: "storage_unavailable", ok: false };

  const entries = readIndex(storage).sort(
    (left, right) => right.lastLocalSaveTimestamp - left.lastLocalSaveTimestamp,
  );

  for (const entry of entries) {
    const result = readStudioDraftSnapshot(entry.draftKey);
    if (result.ok && result.value) {
      return result;
    }
  }

  return { ok: true, value: null };
}

export function writeStudioDraftSnapshot(
  snapshot: StudioDraftSnapshot,
): StudioDraftStoreResult<StudioDraftSnapshot> {
  const storage = getStorage();
  if (!storage) return { error: "storage_unavailable", ok: false };

  try {
    const serializedSources: SerializableStudioSource[] = [];
    for (const source of snapshot.sources) {
      serializedSources.push(...serializeStudioSources([source]));
    }

    const serializedSnapshot: SerializedStudioDraftSnapshot = {
      ...snapshot,
      sources: serializedSources,
    };
    storage.setItem(
      getStorageKey(snapshot.draftKey),
      JSON.stringify(serializedSnapshot),
    );
    upsertIndexEntry(storage, snapshot);
    pruneStudioDraftSnapshots(storage);
    return { ok: true, value: snapshot };
  } catch {
    return { error: "storage_unavailable", ok: false };
  }
}

export async function writeStudioDraftSnapshotWithAssets(input: {
  snapshot: StudioDraftSnapshot;
}): Promise<StudioDraftSnapshotWithAssetsResult> {
  const unsafeSourceIds: string[] = [];
  let assetError: "asset_write_failed" | "indexeddb_unavailable" | null = null;

  for (const source of input.snapshot.sources) {
    if (source.backing.kind !== "local_file") {
      continue;
    }

    const result = await saveStudioDraftWorkbookFile({
      draftKey: input.snapshot.draftKey,
      file: source.backing.file,
      sourceId: source.sourceId,
    });
    if (!result.ok) {
      unsafeSourceIds.push(source.sourceId);
      assetError =
        result.error === "indexeddb_unavailable"
          ? "indexeddb_unavailable"
          : "asset_write_failed";
    }
  }

  const writeResult = writeStudioDraftSnapshot(input.snapshot);
  if (!writeResult.ok) {
    return writeResult;
  }

  if (unsafeSourceIds.length > 0) {
    return {
      assets: {
        error: assetError ?? "asset_write_failed",
        status: "unsafe",
        unsafeSourceIds,
      },
      ok: true,
      value: writeResult.value,
    };
  }

  return {
    assets: { status: "safe" },
    ok: true,
    value: writeResult.value,
  };
}

export function deleteStudioDraftSnapshot(
  draftKey: string,
): StudioDraftStoreResult<null> {
  const storage = getStorage();
  if (!storage) return { error: "storage_unavailable", ok: false };

  try {
    storage.removeItem(getStorageKey(draftKey));
    removeIndexEntry(storage, draftKey);
    return { ok: true, value: null };
  } catch {
    return { error: "storage_unavailable", ok: false };
  }
}

export function listStudioDraftKeys(): string[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  return readIndex(storage).map((entry) => entry.draftKey);
}

export function createStudioDraftSnapshot(input: {
  draftKey: string;
  loadedBlueprintId: string | null;
  sources: StudioSource[];
  blueprintName: string;
  blueprintDescription: string;
  authoringModel: ComposedEditorModel;
  lastRemoteSaveSnapshotKey: string | null;
  timestamp?: number;
}): StudioDraftSnapshot {
  return {
    authoringModel: input.authoringModel,
    blueprintDescription: input.blueprintDescription,
    blueprintName: input.blueprintName,
    draftKey: input.draftKey,
    lastLocalSaveTimestamp: input.timestamp ?? Date.now(),
    lastRemoteSaveSnapshotKey: input.lastRemoteSaveSnapshotKey,
    loadedBlueprintId: input.loadedBlueprintId,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sources: input.sources,
  };
}

type DraftIndexEntry = {
  draftKey: string;
  lastLocalSaveTimestamp: number;
};

function getStorageKey(draftKey: string) {
  return `${STORAGE_PREFIX}${draftKey}`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function isStudioDraftSnapshot(
  value: unknown,
): value is SerializedStudioDraftSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SerializedStudioDraftSnapshot>;
  return (
    candidate.schemaVersion === SNAPSHOT_SCHEMA_VERSION &&
    typeof candidate.draftKey === "string" &&
    (typeof candidate.loadedBlueprintId === "string" ||
      candidate.loadedBlueprintId === null) &&
    Array.isArray(candidate.sources) &&
    candidate.sources.every(isSerializableStudioSource) &&
    typeof candidate.blueprintName === "string" &&
    typeof candidate.blueprintDescription === "string" &&
    isComposedEditorModel(candidate.authoringModel) &&
    typeof candidate.lastLocalSaveTimestamp === "number" &&
    (typeof candidate.lastRemoteSaveSnapshotKey === "string" ||
      candidate.lastRemoteSaveSnapshotKey === null)
  );
}

function isComposedEditorModel(value: unknown): value is ComposedEditorModel {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ComposedEditorModel>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.blocks) &&
    Array.isArray(candidate.responseFields) &&
    Array.isArray(candidate.references)
  );
}

function isSerializableStudioSource(
  value: unknown,
): value is SerializableStudioSource {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SerializableStudioSource>;
  const backing = candidate.backing;
  return (
    candidate.type === "workbook" &&
    typeof candidate.sourceId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof backing === "object" &&
    backing !== null &&
    (backing.kind === "persisted_workbook"
      ? typeof backing.workbookId === "string" &&
        typeof backing.originalName === "string" &&
        (typeof backing.byteSize === "number" || backing.byteSize === null)
      : backing.kind === "local_file"
        ? typeof backing.originalName === "string" &&
          typeof backing.byteSize === "number" &&
          typeof backing.lastModified === "number" &&
          (backing.parseStatus === "parsed" ||
            backing.parseStatus === "failed")
        : backing.kind === "restoring_local_file"
          ? typeof backing.originalName === "string" &&
            typeof backing.byteSize === "number" &&
            typeof backing.lastModified === "number"
          : backing.kind === "draft_file"
            ? typeof backing.byteSize === "number" &&
              typeof backing.checksumSha256 === "string" &&
              typeof backing.fileId === "string" &&
              typeof backing.originalName === "string"
            : backing.kind === "missing_local_file"
              ? typeof backing.originalName === "string" &&
                typeof backing.byteSize === "number" &&
                typeof backing.lastModified === "number" &&
                typeof backing.parseError === "string"
              : false)
  );
}

function readIndex(storage: Storage): DraftIndexEntry[] {
  try {
    const raw = storage.getItem(STORAGE_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isIndexEntry);
  } catch {
    return [];
  }
}

function writeIndex(storage: Storage, entries: DraftIndexEntry[]) {
  storage.setItem(STORAGE_INDEX_KEY, JSON.stringify(entries));
}

function upsertIndexEntry(storage: Storage, snapshot: StudioDraftSnapshot) {
  const next = [
    {
      draftKey: snapshot.draftKey,
      lastLocalSaveTimestamp: snapshot.lastLocalSaveTimestamp,
    },
    ...readIndex(storage).filter(
      (entry) => entry.draftKey !== snapshot.draftKey,
    ),
  ];
  writeIndex(storage, next);
}

function removeIndexEntry(storage: Storage, draftKey: string) {
  writeIndex(
    storage,
    readIndex(storage).filter((entry) => entry.draftKey !== draftKey),
  );
}

function pruneStudioDraftSnapshots(storage: Storage) {
  const now = Date.now();
  const sorted = readIndex(storage).sort(
    (left, right) => right.lastLocalSaveTimestamp - left.lastLocalSaveTimestamp,
  );
  const keep = new Set(
    sorted
      .filter((entry) => now - entry.lastLocalSaveTimestamp <= MAX_DRAFT_AGE_MS)
      .slice(0, MAX_DRAFTS)
      .map((entry) => entry.draftKey),
  );

  for (const entry of sorted) {
    if (!keep.has(entry.draftKey)) {
      storage.removeItem(getStorageKey(entry.draftKey));
    }
  }

  writeIndex(
    storage,
    sorted.filter((entry) => keep.has(entry.draftKey)),
  );
}

function isIndexEntry(value: unknown): value is DraftIndexEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DraftIndexEntry>;
  return (
    typeof candidate.draftKey === "string" &&
    typeof candidate.lastLocalSaveTimestamp === "number"
  );
}
