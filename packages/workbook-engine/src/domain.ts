export const workbookEngineNames = ["cached", "libreoffice"] as const;

export type WorkbookEngineName = (typeof workbookEngineNames)[number];

export type WorkbookEngineConfig = {
  engine: WorkbookEngineName;
  libreOfficeServiceUrl?: string;
  engineTimeoutMs: number;
  validationTimeoutMs: number;
  maxFileBytes: number;
  maxSheets: number;
  maxCells: number;
  maxFormulas: number;
  maxResponseBytes: number;
  maxZipEntries?: number;
  maxZipEntryBytes?: number;
  maxZipTotalUncompressedBytes?: number;
  maxZipCompressionRatio?: number;
  maxXmlPartBytes?: number;
  maxCachedValueBytes?: number;
};

export type ZipEntry = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  offset: number;
};

export type Inspection = {
  sheetCount: number;
  cellCount: number;
  formulaCount: number;
  forbiddenFeatureFindings: string[];
  libreOfficeVersion: string | null;
};

export type WorkbookInspection = Omit<Inspection, "libreOfficeVersion">;

export type WorkbookRejectionReason =
  | "file_too_large"
  | "invalid_zip"
  | "zip_entry_count_exceeded"
  | "zip_entry_too_large"
  | "zip_expanded_size_exceeded"
  | "zip_compression_ratio_exceeded"
  | "zip_duplicate_entry"
  | "zip_path_traversal"
  | "zip_unsupported_compression"
  | "xml_part_too_large"
  | "not_xlsx"
  | "too_many_sheets"
  | "too_many_cells"
  | "too_many_formulas"
  | "unsafe_feature";

export type WorkbookInspectionFinding = {
  code: string;
  part?: string;
};

export type WorkbookValues = {
  sheets: Array<{ name: string; rows: string[][] }>;
};

export type WorkbookCellType =
  | "string"
  | "number"
  | "boolean"
  | "date_like"
  | "error"
  | "blank"
  | "formula_cached";

export type WorkbookSparseSheet = {
  name: string;
  cells: Record<string, string>;
  cellTypes?: Record<string, WorkbookCellType>;
  rowCount: number;
  columnCount: number;
};

export type WorkbookSparseValues = {
  sheets: WorkbookSparseSheet[];
};

export type WorkbookEngineHealth = {
  ok: boolean;
  engine: WorkbookEngineName;
  version: string | null;
};

export type WorkbookEngineOperationOptions = {
  requestId?: string | null;
};

export type WorkbookEngine = {
  name: WorkbookEngineName;
  inspect(
    path: string,
    options?: WorkbookEngineOperationOptions,
  ): Promise<Omit<Inspection, "libreOfficeVersion">>;
  readCachedValues(path: string): Promise<WorkbookSparseValues>;
  recalculate(
    path: string,
    options?: WorkbookEngineOperationOptions,
  ): Promise<WorkbookSparseValues>;
  recalculateBatch?(
    path: string,
    count: number,
    options?: WorkbookEngineOperationOptions,
  ): Promise<WorkbookSparseValues[]>;
  health(
    options?: WorkbookEngineOperationOptions,
  ): Promise<WorkbookEngineHealth>;
};

export type WorkbookEngineErrorCode =
  | "invalid_workbook"
  | "unsupported_workbook"
  | "unsafe_workbook"
  | "workbook_too_large"
  | "workbook_parse_failed"
  | "calculation_failed"
  | "engine_unavailable"
  | "engine_timeout"
  | "engine_response_invalid"
  | "engine_response_too_large";

export class WorkbookEngineError extends Error {
  constructor(
    readonly code: WorkbookEngineErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "WorkbookEngineError";
  }
}

export class InvalidWorkbookError extends WorkbookEngineError {
  constructor(
    message: string,
    readonly inspection: Partial<Inspection> = {},
  ) {
    super("invalid_workbook", message, { inspection });
    this.name = "InvalidWorkbookError";
  }
}
