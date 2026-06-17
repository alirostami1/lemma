import {
  parseWorkbookRef,
  getWorkbookCellRefAtOffset as resolveWorkbookCellRefAtOffset,
} from "../workbook-reference";
import type { ComposedReferenceDraft } from "./composed-model";
import type { TableEditorContentCell, TableEditorModel } from "./table-model";

export type WorkbookRangeMatrix = string[][];

export type TableFromWorkbookRangeResult = {
  table: TableEditorModel;
  references: ComposedReferenceDraft[];
};

type WorkbookRangeReferenceDraft = ComposedReferenceDraft & {
  source: Extract<ComposedReferenceDraft["source"], { type: "workbook_range" }>;
};

export function createTableFromWorkbookRangeReference(input: {
  currentModel: TableEditorModel;
  rangeReference: WorkbookRangeReferenceDraft;
  values: WorkbookRangeMatrix;
  existingReferenceIds: string[];
}): TableFromWorkbookRangeResult {
  void input.existingReferenceIds;
  const shape = validateWorkbookRangeMatrix(input.values);
  const rangeRef = parseWorkbookRef(input.rangeReference.source.ref);
  if (!rangeRef) {
    throw new Error("Selected range reference is invalid.");
  }

  const rows = Array.from({ length: shape.rowCount }, (_, index) => ({
    id: `row_${index + 1}`,
    label: `Row ${index + 1}`,
  }));
  const columns = Array.from({ length: shape.columnCount }, (_, index) => ({
    id: `column_${index + 1}`,
    label: `Column ${index + 1}`,
  }));

  const cells: TableEditorContentCell[] = input.values.flatMap(
    (rowValues, rowIndex) =>
      rowValues.map((value, columnIndex) => {
        if (
          !getWorkbookCellRefAtOffset({
            rangeRef: input.rangeReference.source.ref,
            rowOffset: rowIndex,
            columnOffset: columnIndex,
          })
        ) {
          throw new Error("Selected range reference is invalid.");
        }
        const row = rows[rowIndex];
        const column = columns[columnIndex];
        if (!row || !column) {
          throw new Error("Selected range reference is invalid.");
        }

        return {
          id: `cell_${rowIndex + 1}_${columnIndex + 1}`,
          rowId: row.id,
          columnId: column.id,
          type: "content",
          content: [
            {
              type: "reference",
              referenceId: input.rangeReference.id,
              rangeCell: {
                rowOffset: rowIndex,
                columnOffset: columnIndex,
              },
              fallbackText: value,
            },
          ],
        };
      }),
  );

  return {
    references: [],
    table: {
      ...input.currentModel,
      rows,
      columns,
      cells,
      responseFields: [],
    },
  };
}

export function getWorkbookCellRefAtOffset(input: {
  rangeRef: string;
  rowOffset: number;
  columnOffset: number;
}): string | null {
  return resolveWorkbookCellRefAtOffset(input);
}

function validateWorkbookRangeMatrix(values: WorkbookRangeMatrix): {
  rowCount: number;
  columnCount: number;
} {
  if (values.length === 0) {
    throw new Error("Selected range is empty.");
  }

  const columnCount = values[0]?.length ?? 0;
  if (columnCount === 0) {
    throw new Error("Selected range is empty.");
  }

  for (const row of values) {
    if (row.length !== columnCount) {
      throw new Error("Selected range must be rectangular.");
    }
  }

  return {
    rowCount: values.length,
    columnCount,
  };
}
