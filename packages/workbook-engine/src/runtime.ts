import {
  type WorkbookEngine,
  type WorkbookEngineConfig,
  WorkbookEngineError,
  type WorkbookEngineHealth,
  type WorkbookEngineOperationOptions,
  type WorkbookInspection,
  type WorkbookSparseValues,
} from "./domain.js";
import { inspectXlsx } from "./inspection.js";
import {
  getLibreOfficeWorkerHealth,
  postWorkbookBatchToLibreOfficeWorker,
  postWorkbookToLibreOfficeWorker,
} from "./libreoffice-client.js";
import { readWorkbookSparseValues } from "./values.js";

export async function inspectWorkbook(
  path: string,
  config: WorkbookEngineConfig,
  options?: WorkbookEngineOperationOptions,
): Promise<WorkbookInspection> {
  return createWorkbookEngine(config).inspect(path, options);
}

export async function readCachedWorkbookValues(
  path: string,
  config: WorkbookEngineConfig,
  options?: WorkbookEngineOperationOptions,
): Promise<WorkbookSparseValues> {
  return createWorkbookEngine(config).readCachedValues(path, options);
}

export async function recalculateWorkbook(
  path: string,
  config: WorkbookEngineConfig,
  options?: WorkbookEngineOperationOptions,
): Promise<WorkbookSparseValues> {
  const engine = createWorkbookEngine(config);
  await engine.inspect(path, options);
  return engine.recalculate(path, options);
}

export async function recalculateWorkbookBatch(
  path: string,
  count: number,
  config: WorkbookEngineConfig,
  options?: WorkbookEngineOperationOptions,
): Promise<WorkbookSparseValues[]> {
  if (count < 1) {
    return [];
  }
  const engine = createWorkbookEngine(config);
  await engine.inspect(path, options);
  if (engine.recalculateBatch) {
    return engine.recalculateBatch(path, count, options);
  }
  const values: WorkbookSparseValues[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(await engine.recalculate(path, options));
  }
  return values;
}

export async function getWorkbookEngineHealth(
  config: WorkbookEngineConfig,
  options?: WorkbookEngineOperationOptions,
): Promise<WorkbookEngineHealth> {
  return createWorkbookEngine(config).health(options);
}

export function createWorkbookEngine(
  config: WorkbookEngineConfig,
): WorkbookEngine {
  const name = config.engine ?? "cached";
  if (name === "cached") {
    return createCachedWorkbookEngine(config);
  }
  if (name === "libreoffice") {
    return createLibreOfficeUnoEngine(config);
  }
  throw new WorkbookEngineError(
    "engine_unavailable",
    "Unsupported workbook engine.",
  );
}

function createCachedWorkbookEngine(
  config: WorkbookEngineConfig,
): WorkbookEngine {
  async function readInspectedCachedValues(path: string) {
    await inspectXlsx(path, config);
    return readWorkbookSparseValues(path, config);
  }

  return {
    name: "cached",
    inspect: (path) => inspectXlsx(path, config),
    readCachedValues: readInspectedCachedValues,
    recalculate: readInspectedCachedValues,
    async recalculateBatch(path, count) {
      const values = await readInspectedCachedValues(path);
      return Array.from({ length: count }, () => values);
    },
    async health(): Promise<WorkbookEngineHealth> {
      return { ok: true, engine: "cached", version: "xlsx-cached" };
    },
  };
}

function createLibreOfficeUnoEngine(
  config: WorkbookEngineConfig,
): WorkbookEngine {
  const serviceUrl = config.libreOfficeServiceUrl;
  const timeoutMs = config.engineTimeoutMs ?? config.validationTimeoutMs;
  const maxResponseBytes = config.maxResponseBytes ?? 10 * 1024 * 1024;
  if (!serviceUrl) {
    throw new WorkbookEngineError(
      "engine_unavailable",
      "WORKBOOK_LIBREOFFICE_SERVICE_URL is required for libreoffice-uno.",
    );
  }
  return {
    name: "libreoffice",
    inspect: (path) => inspectXlsx(path, config),
    async readCachedValues(path) {
      await inspectXlsx(path, config);
      return readWorkbookSparseValues(path, config);
    },
    async recalculate(path, options) {
      return postWorkbookToLibreOfficeWorker({
        serviceUrl,
        path,
        timeoutMs,
        maxResponseBytes,
        maxSheets: config.maxSheets,
        maxCells: config.maxCells,
        maxCachedValueBytes:
          config.maxCachedValueBytes ?? config.maxResponseBytes,
        requestId: options?.requestId,
      });
    },
    async recalculateBatch(path, count, options) {
      return postWorkbookBatchToLibreOfficeWorker({
        serviceUrl,
        path,
        count,
        timeoutMs,
        maxResponseBytes,
        maxSheets: config.maxSheets,
        maxCells: config.maxCells,
        maxCachedValueBytes:
          config.maxCachedValueBytes ?? config.maxResponseBytes,
        requestId: options?.requestId,
      });
    },
    async health(options) {
      return getLibreOfficeWorkerHealth({
        serviceUrl,
        timeoutMs,
        maxResponseBytes,
        requestId: options?.requestId,
      });
    },
  };
}
