export type {
  TableAnswerState,
  TableAnswerValue,
  TableBlockEditorProps,
  TableBlockPreviewModel,
  TableBlockPreviewProps,
  TableEditorCell,
  TableEditorInputBlock,
  TableEditorModel,
  TableEditorPrimitiveBlock,
  TableEditorTextBlock,
  TableGrading,
  TableResponseField,
  TableWorkbookEditorTools,
  ValueExpression,
} from "#/domains/questions/authoring";
export {
  coerceAnswerValue,
  coerceLiteralExpressionValue,
  createDefaultTableEditorModel,
  formatAnswerInputValue,
  getPrimaryTableInputBlock,
  getPrimaryTableTextBlock,
  getTableCellEditingKind,
  isValueExpressionType,
  moveTableColumn,
  moveTableRow,
  reorderTableColumns,
  reorderTableRows,
  tableEditorModelToStaticPreviewModel,
} from "#/domains/questions/authoring";
export { TableBlockEditor } from "./table-block-editor";
export { TableBlockPreview } from "./table-block-preview";
export { TableCanvas } from "./table-canvas";
export { TableCellView } from "./table-cell-view";
export { TableContextMenu } from "./table-context-menu";
export {
  addTableColumn,
  addTableRow,
  deleteTableColumn,
  deleteTableRow,
  duplicateTableColumn,
  duplicateTableRow,
  ensureResponseFieldForCell,
  ensureTableCell,
  getTableCell,
  getTableCellAt,
  makeContentCell,
  makeResponseCell,
  moveColumnLeft,
  moveColumnRight,
  moveRowDown,
  moveRowUp,
  pruneUnusedResponseFields,
  repairMissingAnswerFieldForCell,
  resetTableLayout,
  updateContentCellContent,
  updateResponseCellCorrectValueSource,
  updateResponseFieldForCell,
  updateTableCell,
  updateTableCellInputBlockCorrectValueSource,
  updateTableCellTextBlockContent,
  updateTableColumnLabel,
  updateTableLayout,
  updateTableRowLabel,
} from "./table-editor-operations";
export {
  applyWorkbookRangeReferenceToTableBlock,
  createTableFromWorkbookRangeReference,
  getWorkbookCellRefAtOffset,
} from "./table-range-operations";
export type { TableEditorSelection } from "./table-selection";
export type {
  WorkbookDimensionBounds,
  WorkbookPickerController,
  WorkbookPickerRequest,
  WorkbookRangeSelection,
  WorkbookSelectionRequirement,
  WorkbookSelectionType,
} from "./workbook-input";
export {
  useWorkbookPicker,
  WorkbookInput,
  WorkbookInputGroup,
  WorkbookPickerProvider,
} from "./workbook-input";
