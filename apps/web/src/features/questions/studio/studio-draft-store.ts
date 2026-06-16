import type { ComposedEditorModel } from "#/domains/questions/authoring";

const STORAGE_PREFIX = "lemma:studio-draft:v1:";
const STORAGE_INDEX_KEY = "lemma:studio-draft:index:v1";
const SNAPSHOT_SCHEMA_VERSION = 1;
const MAX_DRAFTS = 20;
const MAX_DRAFT_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export type StudioDraftKeyInput = {
  loadedBlueprintId: string | null;
  initialWorkbookId: string;
};

export type StudioDraftSnapshot = {
  schemaVersion: 1;
  draftKey: string;
  loadedBlueprintId: string | null;
  loadedBlueprintVersionId?: string | null;
  selectedWorkbookId: string;
  blueprintName: string;
  blueprintDescription: string;
  authoringModel: ComposedEditorModel;
  lastLocalSaveTimestamp: number;
  lastRemoteSaveSnapshotKey: string | null;
};

export type StudioDraftStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: "storage_unavailable" | "invalid_snapshot" };

export function createStudioDraftKey({
  loadedBlueprintId,
  initialWorkbookId,
}: StudioDraftKeyInput) {
  if (loadedBlueprintId) {
    return `blueprint:${loadedBlueprintId}`;
  }

  return `new:${initialWorkbookId || "default"}`;
}

export function readStudioDraftSnapshot(
  draftKey: string,
): StudioDraftStoreResult<StudioDraftSnapshot | null> {
  const storage = getStorage();
  if (!storage) return { ok: false, error: "storage_unavailable" };

  const storageKey = getStorageKey(draftKey);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return { ok: true, value: null };

    const parsed = JSON.parse(raw);
    if (!isStudioDraftSnapshot(parsed) || parsed.draftKey !== draftKey) {
      storage.removeItem(storageKey);
      removeIndexEntry(storage, draftKey);
      return { ok: false, error: "invalid_snapshot" };
    }

    return { ok: true, value: parsed };
  } catch {
    try {
      storage.removeItem(storageKey);
      removeIndexEntry(storage, draftKey);
    } catch {
      return { ok: false, error: "storage_unavailable" };
    }
    return { ok: false, error: "invalid_snapshot" };
  }
}

export function readLatestStudioDraftSnapshot(): StudioDraftStoreResult<
  StudioDraftSnapshot | null
> {
  const storage = getStorage();
  if (!storage) return { ok: false, error: "storage_unavailable" };

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
  if (!storage) return { ok: false, error: "storage_unavailable" };

  try {
    storage.setItem(getStorageKey(snapshot.draftKey), JSON.stringify(snapshot));
    upsertIndexEntry(storage, snapshot);
    pruneStudioDraftSnapshots(storage);
    return { ok: true, value: snapshot };
  } catch {
    return { ok: false, error: "storage_unavailable" };
  }
}

export function deleteStudioDraftSnapshot(
  draftKey: string,
): StudioDraftStoreResult<null> {
  const storage = getStorage();
  if (!storage) return { ok: false, error: "storage_unavailable" };

  try {
    storage.removeItem(getStorageKey(draftKey));
    removeIndexEntry(storage, draftKey);
    return { ok: true, value: null };
  } catch {
    return { ok: false, error: "storage_unavailable" };
  }
}

export function createStudioDraftSnapshot(input: {
  draftKey: string;
  loadedBlueprintId: string | null;
  loadedBlueprintVersionId?: string | null;
  selectedWorkbookId: string;
  blueprintName: string;
  blueprintDescription: string;
  authoringModel: ComposedEditorModel;
  lastRemoteSaveSnapshotKey: string | null;
  timestamp?: number;
}): StudioDraftSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    draftKey: input.draftKey,
    loadedBlueprintId: input.loadedBlueprintId,
    loadedBlueprintVersionId: input.loadedBlueprintVersionId ?? null,
    selectedWorkbookId: input.selectedWorkbookId,
    blueprintName: input.blueprintName,
    blueprintDescription: input.blueprintDescription,
    authoringModel: input.authoringModel,
    lastLocalSaveTimestamp: input.timestamp ?? Date.now(),
    lastRemoteSaveSnapshotKey: input.lastRemoteSaveSnapshotKey,
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

function isStudioDraftSnapshot(value: unknown): value is StudioDraftSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudioDraftSnapshot>;
  return (
    candidate.schemaVersion === SNAPSHOT_SCHEMA_VERSION &&
    typeof candidate.draftKey === "string" &&
    (typeof candidate.loadedBlueprintId === "string" ||
      candidate.loadedBlueprintId === null) &&
    (typeof candidate.loadedBlueprintVersionId === "string" ||
      typeof candidate.loadedBlueprintVersionId === "undefined" ||
      candidate.loadedBlueprintVersionId === null) &&
    typeof candidate.selectedWorkbookId === "string" &&
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
    ...readIndex(storage).filter((entry) => entry.draftKey !== snapshot.draftKey),
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
