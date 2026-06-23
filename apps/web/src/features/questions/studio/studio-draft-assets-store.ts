const DATABASE_NAME = "lemma-studio-drafts";
const DATABASE_VERSION = 1;
const WORKBOOK_FILES_STORE = "workbookFiles";

type StoredWorkbookFileAsset = {
  draftKey: string;
  sourceId: string;
  fileName: string;
  type: string;
  byteSize: number;
  lastModified: number;
  blob: Blob;
  createdAt: number;
  updatedAt: number;
};

export type StudioDraftAssetResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error:
        | "indexeddb_unavailable"
        | "not_found"
        | "invalid_asset"
        | "write_failed"
        | "read_failed";
    };

export async function saveStudioDraftWorkbookFile(input: {
  draftKey: string;
  sourceId: string;
  file: File;
}): Promise<StudioDraftAssetResult<void>> {
  const database = await openDraftDatabase();
  if (!database.ok) {
    return database;
  }

  const key = createAssetKey(input.draftKey, input.sourceId);
  const now = Date.now();
  const existingAsset = await readStoredAsset(database.value, key);
  const createdAt =
    existingAsset.ok && existingAsset.value
      ? existingAsset.value.createdAt
      : now;

  return runTransaction(
    database.value,
    "readwrite",
    async (store) => {
      await requestToPromise(
        store.put({
          blob: input.file,
          byteSize: input.file.size,
          createdAt,
          draftKey: input.draftKey,
          fileName: input.file.name,
          lastModified: input.file.lastModified,
          sourceId: input.sourceId,
          type: input.file.type,
          updatedAt: now,
        } satisfies StoredWorkbookFileAsset),
      );
      return { ok: true, value: undefined };
    },
    "write_failed",
  );
}

export async function readStudioDraftWorkbookFile(input: {
  draftKey: string;
  sourceId: string;
}): Promise<StudioDraftAssetResult<File | null>> {
  const database = await openDraftDatabase();
  if (!database.ok) {
    return database;
  }

  const storedAssetResult = await readStoredAsset(
    database.value,
    createAssetKey(input.draftKey, input.sourceId),
  );
  if (!storedAssetResult.ok) {
    return storedAssetResult.error === "not_found"
      ? { ok: true, value: null }
      : storedAssetResult;
  }

  const storedAsset = storedAssetResult.value;
  if (!storedAsset) {
    return { ok: true, value: null };
  }

  return {
    ok: true,
    value: new File([storedAsset.blob], storedAsset.fileName, {
      lastModified: storedAsset.lastModified,
      type: storedAsset.type,
    }),
  };
}

export async function deleteStudioDraftWorkbookFile(input: {
  draftKey: string;
  sourceId: string;
}): Promise<StudioDraftAssetResult<void>> {
  const database = await openDraftDatabase();
  if (!database.ok) {
    return database;
  }

  return runTransaction(
    database.value,
    "readwrite",
    async (store) => {
      await requestToPromise(
        store.delete(createAssetKey(input.draftKey, input.sourceId)),
      );
      return { ok: true, value: undefined };
    },
    "write_failed",
  );
}

export async function pruneStudioDraftWorkbookFiles(input: {
  liveDraftKeys: readonly string[];
}): Promise<StudioDraftAssetResult<void>> {
  const database = await openDraftDatabase();
  if (!database.ok) {
    return database;
  }

  const liveDraftKeys = new Set(input.liveDraftKeys);
  return runTransaction(
    database.value,
    "readwrite",
    async (store) => {
      const assets = await getAllStoredAssets(store);
      for (const asset of assets) {
        if (!liveDraftKeys.has(asset.draftKey)) {
          await requestToPromise(
            store.delete(createAssetKey(asset.draftKey, asset.sourceId)),
          );
        }
      }

      return { ok: true, value: undefined };
    },
    "write_failed",
  );
}

async function openDraftDatabase(): Promise<
  StudioDraftAssetResult<IDBDatabase>
> {
  if (
    typeof window === "undefined" ||
    typeof window.indexedDB === "undefined"
  ) {
    return { error: "indexeddb_unavailable", ok: false };
  }

  try {
    const openRequest = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    openRequest.onupgradeneeded = () => {
      const database = openRequest.result;
      if (!database.objectStoreNames.contains(WORKBOOK_FILES_STORE)) {
        database.createObjectStore(WORKBOOK_FILES_STORE);
      }
    };

    const database = await requestToPromise(openRequest);
    return { ok: true, value: database };
  } catch {
    return { error: "indexeddb_unavailable", ok: false };
  }
}

async function readStoredAsset(
  database: IDBDatabase,
  key: string,
): Promise<StudioDraftAssetResult<StoredWorkbookFileAsset | null>> {
  return runTransaction(
    database,
    "readonly",
    async (store) => {
      const value = await requestToPromise<unknown>(store.get(key));
      if (value === undefined) {
        return { error: "not_found", ok: false } as const;
      }
      if (!isStoredWorkbookFileAsset(value)) {
        return { error: "invalid_asset", ok: false } as const;
      }

      return { ok: true, value } as const;
    },
    "read_failed",
  );
}

async function getAllStoredAssets(
  store: IDBObjectStore,
): Promise<StoredWorkbookFileAsset[]> {
  const values = await requestToPromise<unknown[]>(store.getAll());
  return values.filter(isStoredWorkbookFileAsset);
}

async function runTransaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<StudioDraftAssetResult<T>>,
  error: "write_failed" | "read_failed",
): Promise<StudioDraftAssetResult<T>> {
  let transaction: IDBTransaction;

  try {
    transaction = database.transaction(WORKBOOK_FILES_STORE, mode);
  } catch {
    return { error, ok: false };
  }

  const store = transaction.objectStore(WORKBOOK_FILES_STORE);
  const completion = transactionToPromise(transaction);

  try {
    const result = await run(store);
    await completion;
    return result;
  } catch {
    try {
      if (!transaction.error) {
        transaction.abort();
      }
    } catch {
      // Transaction may already have completed or aborted.
    }
    return { error, ok: false };
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function isStoredWorkbookFileAsset(
  value: unknown,
): value is StoredWorkbookFileAsset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredWorkbookFileAsset>;
  return (
    typeof candidate.draftKey === "string" &&
    typeof candidate.sourceId === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.byteSize === "number" &&
    typeof candidate.lastModified === "number" &&
    candidate.blob instanceof Blob &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number"
  );
}

function createAssetKey(draftKey: string, sourceId: string): string {
  return `${draftKey}:${sourceId}`;
}
