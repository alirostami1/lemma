import type {
  ComposedEditorModel,
  ComposedReferenceDraft,
  TableEditorContentCell,
  TableEditorModel,
} from "#/domains/questions/authoring";
import {
  getWorkbookCellRefAtOffset as resolveWorkbookCellRefAtOffset,
  parseWorkbookRef,
} from "#/domains/questions/workbook-reference";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";

export type WorkbookRangeMatrix = string[][];

export type TableFromWorkbookRangeResult = {
  table: TableEditorModel;
  references: ComposedReferenceDraft[];
};

export type ApplyRangeToTableResult =
  | { ok: true; model: ComposedEditorModel }
  | { ok: false; message: string };

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

export function applyWorkbookRangeReferenceToTableBlock(input: {
  editorModel: ComposedEditorModel;
  tableBlockId: string;
  rangeReferenceId: string;
  referencePreviewCache: ReferencePreviewCache;
}): ApplyRangeToTableResult {
  const reference = input.editorModel.references.find(
    (candidate) => candidate.id === input.rangeReferenceId,
  );
  if (!reference) {
    return { ok: false, message: "Selected range reference was not found." };
  }
  if (!isWorkbookRangeReferenceDraft(reference)) {
    return {
      ok: false,
      message: "Selected reference is not a workbook range.",
    };
  }

  const preview = input.referencePreviewCache[reference.id];
  if (!preview) {
    return {
      ok: false,
      message: "Select a ready source to preview this range.",
    };
  }
  if (preview.status !== "resolved") {
    return {
      ok: false,
      message: "Selected range is not ready to apply.",
    };
  }
  if (!isStringMatrix(preview.rawValue)) {
    return {
      ok: false,
      message: "Selected range must be a rectangular 2D array of values.",
    };
  }

  const tableBlock = input.editorModel.blocks.find(
    (block) => block.id === input.tableBlockId && block.type === "table",
  );
  if (!tableBlock || tableBlock.type !== "table") {
    return { ok: false, message: "Selected table was not found." };
  }

  let result: TableFromWorkbookRangeResult;
  try {
    result = createTableFromWorkbookRangeReference({
      currentModel: tableBlock.table,
      rangeReference: reference,
      values: preview.rawValue,
      existingReferenceIds: input.editorModel.references.map((item) => item.id),
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to create table from the selected range.",
    };
  }

  return {
    ok: true,
    model: {
      ...input.editorModel,
      references: [...input.editorModel.references, ...result.references],
      blocks: input.editorModel.blocks.map((block) =>
        block.id === input.tableBlockId && block.type === "table"
          ? { ...block, table: result.table }
          : block,
      ),
    },
  };
}

function isWorkbookRangeReferenceDraft(
  reference: ComposedReferenceDraft,
): reference is WorkbookRangeReferenceDraft {
  return reference.source.type === "workbook_range";
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

function isStringMatrix(value: unknown): value is WorkbookRangeMatrix {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length > 0 &&
        row.every((cell) => typeof cell === "string"),
    )
  );
}
