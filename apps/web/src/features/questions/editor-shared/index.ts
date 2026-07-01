export {
  formatCanonicalReferenceTokenFallback,
  type ReferencePreviewCache,
  type ReferencePreviewStatus,
  type ReferencePreviewValue,
  resolveInlineReferencePreview,
  resolveReferencePreviewValues,
  resolveValueExpressionPreview,
  type WorkbookPreviewForReferences,
} from "#/domains/questions/reference-preview";
export {
  InlineContentRenderer,
  type InlineRenderMode,
} from "./inline-content-renderer";
export { ReferenceChip } from "./reference-chip";
export { RichContentPreview } from "./rich-content-preview";
export {
  addTableRangeToSelection,
  describeTableSelection,
  describeTableSelectionFromSummary,
  extendTableSelection,
  getCoordinatesInRange,
  getSelectedTableCoordinateKeySet,
  getSelectedTableCoordinates,
  isActiveTableCell,
  isCoordinateSelected,
  isTableSelectionEqual,
  normalizeTableSelection,
  selectTableCell,
  selectTableRange,
  type TableCellCoordinate,
  type TableCellRange,
  type TableCellSelection,
  type TableEditorSelection,
  tableCoordinateKey,
} from "./selection-types";
