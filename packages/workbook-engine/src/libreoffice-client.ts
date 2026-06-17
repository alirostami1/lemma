import { readFile } from "node:fs/promises";
import {
  WorkbookEngineError,
  type WorkbookEngineHealth,
  type WorkbookSparseValues,
} from "./domain.js";
import {
  inferWorkbookSparseSheetSize,
  normalizeWorkbookSparseValues,
  type WorkbookValueLimits,
} from "./values.js";

export async function postWorkbookBatchToLibreOfficeWorker(input: {
  serviceUrl: string;
  path: string;
  count: number;
  timeoutMs: number;
  maxResponseBytes: number;
  maxSheets: number;
  maxCells: number;
  maxCachedValueBytes: number;
  requestId?: string | null;
}) {
  const workbook = await readFile(input.path);
  const url = new URL("/v1/batch-calculations", input.serviceUrl);
  url.searchParams.set("count", String(input.count));
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ...workerHeaders(input.requestId),
      },
      body: new Uint8Array(workbook),
    },
    input.timeoutMs * input.count,
  );
  if (!response.ok) {
    throw mapWorkerError(response.status, "batch calculate");
  }
  return parseWorkerResponse(response, input.maxResponseBytes, (value) =>
    parseWorkerBatchValues(value, input),
  );
}

export async function postWorkbookToLibreOfficeWorker(input: {
  serviceUrl: string;
  path: string;
  timeoutMs: number;
  maxResponseBytes: number;
  maxSheets: number;
  maxCells: number;
  maxCachedValueBytes: number;
  requestId?: string | null;
}) {
  const workbook = await readFile(input.path);
  const response = await fetchWithTimeout(
    new URL("/v1/calculations", input.serviceUrl),
    {
      method: "POST",
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ...workerHeaders(input.requestId),
      },
      body: new Uint8Array(workbook),
    },
    input.timeoutMs,
  );
  if (!response.ok) {
    throw mapWorkerError(response.status, "calculate");
  }
  return parseWorkerResponse(response, input.maxResponseBytes, (value) =>
    parseWorkerValues(value, input),
  );
}

export async function getLibreOfficeWorkerHealth(input: {
  serviceUrl: string;
  timeoutMs: number;
  maxResponseBytes: number;
  requestId?: string | null;
}): Promise<WorkbookEngineHealth> {
  const response = await fetchWithTimeout(
    new URL("/v1/health", input.serviceUrl),
    { method: "GET", headers: workerHeaders(input.requestId) },
    input.timeoutMs,
  );
  if (!response.ok) {
    throw mapWorkerError(response.status, "health check");
  }
  const parsed = await parseWorkerResponse(
    response,
    input.maxResponseBytes,
    parseWorkerHealth,
  );
  return {
    ok: parsed.ok,
    engine: "libreoffice",
    version: parsed.version,
  };
}

function workerHeaders(requestId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (requestId) {
    headers["x-request-id"] = requestId;
  }
  const secret = process.env.WORKBOOK_WORKER_SHARED_SECRET;
  if (secret) {
    headers.authorization = `Bearer ${secret}`;
  }
  return headers;
}

function mapWorkerError(
  status: number,
  operation: string,
): WorkbookEngineError {
  if (status === 400) {
    return new WorkbookEngineError(
      "invalid_workbook",
      `LibreOffice worker ${operation} rejected workbook request.`,
    );
  }
  if (status === 413) {
    return new WorkbookEngineError(
      "workbook_too_large",
      "LibreOffice worker rejected workbook upload as too large.",
    );
  }
  if (status === 504) {
    return new WorkbookEngineError(
      "engine_timeout",
      `LibreOffice worker ${operation} timed out.`,
    );
  }
  if (status === 507) {
    return new WorkbookEngineError(
      "engine_response_too_large",
      "LibreOffice worker response is too large.",
    );
  }
  if (status >= 500) {
    return new WorkbookEngineError(
      "calculation_failed",
      `LibreOffice worker ${operation} failed with ${status}.`,
    );
  }
  return new WorkbookEngineError(
    "engine_unavailable",
    `LibreOffice worker ${operation} failed with ${status}.`,
  );
}

async function parseWorkerResponse<T>(
  response: Response,
  maxResponseBytes: number,
  parser: (value: unknown) => T,
) {
  const length = response.headers.get("content-length");
  if (length && Number(length) > maxResponseBytes) {
    throw new WorkbookEngineError(
      "engine_response_too_large",
      "LibreOffice worker response is too large.",
    );
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maxResponseBytes) {
    throw new WorkbookEngineError(
      "engine_response_too_large",
      "LibreOffice worker response is too large.",
    );
  }
  try {
    return parser(JSON.parse(text));
  } catch (error) {
    if (error instanceof WorkbookEngineError) {
      throw error;
    }
    throw new WorkbookEngineError(
      "engine_response_invalid",
      "LibreOffice worker returned invalid workbook values.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

async function fetchWithTimeout(
  url: URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new WorkbookEngineError(
        "engine_timeout",
        "Workbook engine request timed out.",
      );
    }
    throw new WorkbookEngineError(
      "engine_unavailable",
      "Workbook engine request failed.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseWorkerHealth(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new WorkbookEngineError(
      "engine_response_invalid",
      "LibreOffice worker health response is invalid.",
    );
  }
  const data = value as Record<string, unknown>;
  return {
    ok: data.ok === true,
    version: typeof data.version === "string" ? data.version : null,
  };
}

function parseWorkerValues(
  value: unknown,
  limits: WorkbookValueLimits,
): WorkbookSparseValues {
  if (!value || typeof value !== "object") {
    throw new Error("Workbook values must be an object.");
  }
  const data = value as Record<string, unknown>;
  const sheets = data.sheets;
  if (!Array.isArray(sheets)) {
    throw new Error("Workbook values must include sheets.");
  }
  return normalizeWorkbookSparseValues(
    {
      sheets: sheets.map((sheet) => {
        if (!sheet || typeof sheet !== "object") {
          throw new Error("Workbook sheet must be an object.");
        }
        const item = sheet as Record<string, unknown>;
        if (
          typeof item.name !== "string" ||
          !item.cells ||
          typeof item.cells !== "object"
        ) {
          throw new Error("Workbook sheet is missing name or cells.");
        }
        const cells = Object.fromEntries(
          Object.entries(item.cells as Record<string, unknown>).map(
            ([key, cell]) => [key, cell == null ? "" : String(cell)],
          ),
        );
        const inferred = inferWorkbookSparseSheetSize(cells);
        return {
          name: item.name,
          cells,
          rowCount:
            typeof item.rowCount === "number" && Number.isInteger(item.rowCount)
              ? Math.max(item.rowCount, inferred.rowCount)
              : inferred.rowCount,
          columnCount:
            typeof item.columnCount === "number" &&
            Number.isInteger(item.columnCount)
              ? Math.max(item.columnCount, inferred.columnCount)
              : inferred.columnCount,
        };
      }),
    },
    limits,
  );
}

function parseWorkerBatchValues(
  value: unknown,
  limits: WorkbookValueLimits,
): WorkbookSparseValues[] {
  if (!value || typeof value !== "object") {
    throw new Error("Workbook batch values must be an object.");
  }
  const snapshots = (value as Record<string, unknown>).snapshots;
  if (!Array.isArray(snapshots)) {
    throw new Error("Workbook batch values must include snapshots.");
  }
  return snapshots.map((snapshot) => parseWorkerValues(snapshot, limits));
}
