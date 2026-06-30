import type {
  ComposedEditorModel,
  ComposedReferenceDraft,
  TableEditorCell,
  TableEditorModel,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  parseWorkbookRef,
  getWorkbookCellRefAtOffset as resolveWorkbookCellRefAtOffset,
} from "#/domains/questions/workbook-reference";

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
}): TableFromWorkbookRangeResult {
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

  const cells: TableEditorCell[] = input.values.flatMap((rowValues, rowIndex) =>
    rowValues.map((value, columnIndex) => {
      if (
        !getWorkbookCellRefAtOffset({
          columnOffset: columnIndex,
          rangeRef: input.rangeReference.source.ref,
          rowOffset: rowIndex,
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
        blocks: [
          {
            content: [
              {
                fallbackText: value,
                rangeCell: {
                  columnOffset: columnIndex,
                  rowOffset: rowIndex,
                },
                referenceId: input.rangeReference.id,
                type: "reference",
              },
            ],
            id: `${input.currentModel.blockId ?? "table"}_cell_${rowIndex + 1}_${columnIndex + 1}_text`,
            type: "text",
          },
        ],
        columnId: column.id,
        id: `cell_${rowIndex + 1}_${columnIndex + 1}`,
        rowId: row.id,
      };
    }),
  );

  return {
    references: [],
    table: {
      ...input.currentModel,
      cells,
      columns,
      responseFields: [],
      rows,
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
    return { message: "Selected range reference was not found.", ok: false };
  }
  if (!isWorkbookRangeReferenceDraft(reference)) {
    return {
      message: "Selected reference is not a workbook range.",
      ok: false,
    };
  }

  const preview = input.referencePreviewCache[reference.id];
  if (!preview) {
    return {
      message: "Select a ready source to preview this range.",
      ok: false,
    };
  }
  if (preview.status !== "resolved") {
    return {
      message: "Selected range is not ready to apply.",
      ok: false,
    };
  }
  if (!isStringMatrix(preview.rawValue)) {
    return {
      message: "Selected range must be a rectangular 2D array of values.",
      ok: false,
    };
  }

  const tableBlock = input.editorModel.blocks.find(
    (block) => block.id === input.tableBlockId && block.type === "table",
  );
  if (tableBlock?.type !== "table") {
    return { message: "Selected table was not found.", ok: false };
  }

  let result: TableFromWorkbookRangeResult;
  try {
    result = createTableFromWorkbookRangeReference({
      currentModel: tableBlock.table,
      rangeReference: reference,
      values: preview.rawValue,
    });
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Unable to create table from the selected range.",
      ok: false,
    };
  }

  return {
    model: {
      ...input.editorModel,
      blocks: input.editorModel.blocks.map((block) =>
        block.id === input.tableBlockId && block.type === "table"
          ? { ...block, table: result.table }
          : block,
      ),
      references: [...input.editorModel.references, ...result.references],
    },
    ok: true,
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
    columnCount,
    rowCount: values.length,
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
