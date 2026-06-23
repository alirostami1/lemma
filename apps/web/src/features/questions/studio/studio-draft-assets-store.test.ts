// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  deleteStudioDraftWorkbookFile,
  pruneStudioDraftWorkbookFiles,
  readStudioDraftWorkbookFile,
  saveStudioDraftWorkbookFile,
} from "./studio-draft-assets-store";

type StoredAsset = {
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

type FakeRequest<T> = {
  result: T;
  error: DOMException | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
};

type FakeOpenRequest = FakeRequest<FakeDatabase> & {
  onupgradeneeded: (() => void) | null;
};

type FakeTransaction = {
  error: DOMException | null;
  oncomplete: (() => void) | null;
  onabort: (() => void) | null;
  onerror: (() => void) | null;
  abort(): void;
  objectStore(name: string): FakeObjectStore;
};

type FakeObjectStore = {
  put(value: unknown): FakeRequest<void>;
  get(key: string): FakeRequest<unknown>;
  getAll(): FakeRequest<unknown[]>;
  delete(key: string): FakeRequest<void>;
};

type FakeDatabase = {
  objectStoreNames: {
    contains(name: string): boolean;
  };
  createObjectStore(name: string): void;
  transaction(name: string, mode: IDBTransactionMode): FakeTransaction;
};

describe("studio draft assets store", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "indexedDB");
  });

  it("writes then reads a workbook file without missing transaction completion", async () => {
    installFakeIndexedDb();
    const file = new File(["xlsx-bytes"], "budget.xlsx", {
      lastModified: 123,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(
      Promise.race([
        saveStudioDraftWorkbookFile({
          draftKey: "new:default",
          file,
          sourceId: "source_1",
        }),
        settleAfterOneMacrotask(),
      ]),
    ).resolves.toEqual({ ok: true, value: undefined });

    const result = await readStudioDraftWorkbookFile({
      draftKey: "new:default",
      sourceId: "source_1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) {
      throw new Error("Expected stored draft file.");
    }
    expect(result.value.name).toBe("budget.xlsx");
    expect(result.value.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(result.value.lastModified).toBe(123);
    await expect(result.value.text()).resolves.toBe("xlsx-bytes");
  });

  it("returns null for a missing asset", async () => {
    installFakeIndexedDb();

    await expect(
      readStudioDraftWorkbookFile({
        draftKey: "new:default",
        sourceId: "missing",
      }),
    ).resolves.toEqual({ ok: true, value: null });
  });

  it("returns invalid asset for malformed stored data", async () => {
    const records = new Map<string, unknown>([
      ["new:default:source_1", { draftKey: "new:default" }],
    ]);
    installFakeIndexedDb(records);

    await expect(
      readStudioDraftWorkbookFile({
        draftKey: "new:default",
        sourceId: "source_1",
      }),
    ).resolves.toEqual({ error: "invalid_asset", ok: false });
  });

  it("deletes draft assets", async () => {
    installFakeIndexedDb();
    await saveStudioDraftWorkbookFile({
      draftKey: "new:default",
      file: new File(["xlsx-bytes"], "budget.xlsx", { lastModified: 123 }),
      sourceId: "source_1",
    });

    await expect(
      deleteStudioDraftWorkbookFile({
        draftKey: "new:default",
        sourceId: "source_1",
      }),
    ).resolves.toEqual({ ok: true, value: undefined });
    await expect(
      readStudioDraftWorkbookFile({
        draftKey: "new:default",
        sourceId: "source_1",
      }),
    ).resolves.toEqual({ ok: true, value: null });
  });

  it("prunes assets outside live draft keys", async () => {
    installFakeIndexedDb();
    await saveStudioDraftWorkbookFile({
      draftKey: "new:live",
      file: new File(["live"], "live.xlsx", { lastModified: 1 }),
      sourceId: "source_1",
    });
    await saveStudioDraftWorkbookFile({
      draftKey: "new:stale",
      file: new File(["stale"], "stale.xlsx", { lastModified: 2 }),
      sourceId: "source_2",
    });

    await expect(
      pruneStudioDraftWorkbookFiles({ liveDraftKeys: ["new:live"] }),
    ).resolves.toEqual({ ok: true, value: undefined });
    await expect(
      readStudioDraftWorkbookFile({
        draftKey: "new:live",
        sourceId: "source_1",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      readStudioDraftWorkbookFile({
        draftKey: "new:stale",
        sourceId: "source_2",
      }),
    ).resolves.toEqual({ ok: true, value: null });
  });
});

function installFakeIndexedDb(records = new Map<string, unknown>()) {
  const database = createFakeDatabase(records);
  Object.defineProperty(window, "indexedDB", {
    configurable: true,
    value: {
      open() {
        const request = createOpenRequest(database);
        queueMicrotask(() => {
          request.onupgradeneeded?.();
          request.onsuccess?.();
        });
        return request;
      },
    },
  });
}

function createFakeDatabase(records: Map<string, unknown>): FakeDatabase {
  return {
    createObjectStore() {
      return undefined;
    },
    objectStoreNames: {
      contains() {
        return true;
      },
    },
    transaction() {
      return createTransaction(records);
    },
  };
}

function createTransaction(records: Map<string, unknown>): FakeTransaction {
  const transaction: FakeTransaction = {
    abort() {
      transaction.error = new DOMException(
        "Transaction aborted.",
        "AbortError",
      );
      transaction.onabort?.();
    },
    error: null,
    objectStore() {
      return createObjectStore(records, transaction);
    },
    onabort: null,
    oncomplete: null,
    onerror: null,
  };
  return transaction;
}

function createObjectStore(
  records: Map<string, unknown>,
  transaction: FakeTransaction,
): FakeObjectStore {
  return {
    delete(key) {
      const request = createRequest<void>(undefined);
      queueMicrotask(() => {
        records.delete(key);
        request.onsuccess?.();
        transaction.oncomplete?.();
      });
      return request;
    },
    get(key) {
      const request = createRequest<unknown>(undefined);
      queueMicrotask(() => {
        request.result = records.get(key);
        request.onsuccess?.();
        transaction.oncomplete?.();
      });
      return request;
    },
    getAll() {
      const request = createRequest<unknown[]>([]);
      queueMicrotask(() => {
        request.result = [...records.values()];
        request.onsuccess?.();
        transaction.oncomplete?.();
      });
      return request;
    },
    put(value) {
      const request = createRequest<void>(undefined);
      queueMicrotask(() => {
        if (isStoredAsset(value)) {
          records.set(`${value.draftKey}:${value.sourceId}`, value);
        }
        request.onsuccess?.();
        transaction.oncomplete?.();
      });
      return request;
    },
  };
}

function createOpenRequest(database: FakeDatabase): FakeOpenRequest {
  return {
    error: null,
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
    result: database,
  };
}

function createRequest<T>(initialResult: T): FakeRequest<T> {
  return {
    error: null,
    onerror: null,
    onsuccess: null,
    result: initialResult,
  };
}

function isStoredAsset(value: unknown): value is StoredAsset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    draftKey?: unknown;
    sourceId?: unknown;
    fileName?: unknown;
    type?: unknown;
    byteSize?: unknown;
    lastModified?: unknown;
    blob?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };
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

function settleAfterOneMacrotask(): Promise<"timeout"> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("timeout"), 0);
  });
}
