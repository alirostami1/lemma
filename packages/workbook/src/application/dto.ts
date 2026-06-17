import type { JsonValue } from "@lemma/domain";
import type {
  Workbook,
  WorkbookCalculation,
  WorkbookEngineHealth,
  WorkbookSnapshot,
  WorkbookSnapshotPreview,
} from "../domain/index.js";

export type WorkbooksResult = {
  workbooks: Workbook[];
  nextCursor: string | null;
};
export type WorkbookResult = { workbook: Workbook };
export type WorkbookCalculationsResult = {
  workbookCalculations: WorkbookCalculation[];
  nextCursor: string | null;
};
export type WorkbookCalculationDto = {
  workbookCalculation: WorkbookCalculation;
};
export type WorkbookSnapshotsResult = {
  workbookSnapshots: WorkbookSnapshot[];
  nextCursor: string | null;
};
export type WorkbookSnapshotResult = { workbookSnapshot: WorkbookSnapshot };
export type WorkbookSnapshotPreviewResult = {
  workbookSnapshotPreview: WorkbookSnapshotPreview;
};
export type WorkbookSnapshotValueResult = { value: JsonValue };
export type WorkbookEngineHealthResult = { health: WorkbookEngineHealth };
