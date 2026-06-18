import {
  type ComposedEditorModel,
  formatAnswerInputValue,
  type RangeCellOffset,
  type ReferenceSourceDraft,
  type ValueExpression,
} from "./authoring";
import {
  normalizeWorkbookRef,
  resolveWorkbookPreviewValue,
  type WorkbookPreviewForReferences,
} from "./workbook-reference";

export type ReferencePreviewStatus = "resolved" | "missing_source" | "error";

export type ReferencePreviewValue = {
  referenceId: string;
  status: ReferencePreviewStatus;
  displayValue: string;
  rawValue?: unknown;
  updatedAt: number;
};

export type LiteralPreviewValue = {
  status: "literal";
  displayValue: string;
  rawValue: unknown;
};

export type ReferencePreviewCache = Record<string, ReferencePreviewValue>;
export type WorkbookSelectionValuesByRef = Record<string, string[][]>;

export type { WorkbookPreviewForReferences };

export function resolveReferencePreviewValues({
  model,
  workbookSelectionValuesByRef = {},
  workbookPreview,
  now = Date.now(),
}: {
  model: ComposedEditorModel;
  workbookSelectionValuesByRef?: WorkbookSelectionValuesByRef;
  workbookPreview: WorkbookPreviewForReferences | null;
  now?: number;
}): ReferencePreviewCache {
  const cache: ReferencePreviewCache = {};

  for (const reference of model.references) {
    cache[reference.id] = resolveReferenceSourcePreview({
      referenceId: reference.id,
      source: reference.source,
      workbookSelectionValuesByRef,
      workbookPreview,
      now,
    });
  }

  return cache;
}

export function formatReferenceFallback(
  referenceId: string,
  rangeCell?: RangeCellOffset,
) {
  const cellSuffix = rangeCell
    ? `[${rangeCell.rowOffset},${rangeCell.columnOffset}]`
    : "";
  return `{{ .${referenceId}${cellSuffix} }}`;
}

export function resolveInlineReferencePreview({
  referenceId,
  rangeCell,
  fallbackText,
  referencePreviewCache,
  now = Date.now(),
}: {
  referenceId: string;
  rangeCell?: RangeCellOffset;
  fallbackText?: string;
  referencePreviewCache: ReferencePreviewCache;
  now?: number;
}): ReferencePreviewValue {
  const basePreview = referencePreviewCache[referenceId];
  if (!basePreview) {
    return {
      referenceId,
      status: "missing_source",
      displayValue:
        fallbackText ?? formatReferenceFallback(referenceId, rangeCell),
      updatedAt: now,
    };
  }

  if (!rangeCell) {
    return basePreview;
  }

  if (basePreview.status !== "resolved") {
    return {
      ...basePreview,
      displayValue:
        fallbackText ?? formatReferenceFallback(referenceId, rangeCell),
    };
  }

  const cellValue = resolveRangeCellValue(basePreview.rawValue, rangeCell);
  if (cellValue.status === "error") {
    return {
      referenceId,
      status: "error",
      displayValue:
        fallbackText ?? formatReferenceFallback(referenceId, rangeCell),
      updatedAt: basePreview.updatedAt,
    };
  }

  return {
    referenceId,
    status: "resolved",
    displayValue: formatUnknownPreviewValue(cellValue.value),
    rawValue: cellValue.value,
    updatedAt: basePreview.updatedAt,
  };
}

export function resolveValueExpressionPreview({
  value,
  referencePreviewCache,
  now = Date.now(),
}: {
  value: ValueExpression;
  referencePreviewCache: ReferencePreviewCache;
  now?: number;
}): ReferencePreviewValue | LiteralPreviewValue {
  if (value.type === "literal") {
    return {
      status: "literal",
      displayValue: formatAnswerInputValue(value.value),
      rawValue: value.value,
    };
  }

  return (
    referencePreviewCache[value.referenceId] ?? {
      referenceId: value.referenceId,
      status: "missing_source",
      displayValue: formatReferenceFallback(value.referenceId),
      updatedAt: now,
    }
  );
}

function resolveReferenceSourcePreview({
  referenceId,
  source,
  workbookSelectionValuesByRef,
  workbookPreview,
  now,
}: {
  referenceId: string;
  source: ReferenceSourceDraft;
  workbookSelectionValuesByRef: WorkbookSelectionValuesByRef;
  workbookPreview: WorkbookPreviewForReferences | null;
  now: number;
}): ReferencePreviewValue {
  if (source.type === "literal") {
    return {
      referenceId,
      status: "resolved",
      displayValue: formatAnswerInputValue(source.value),
      rawValue: source.value,
      updatedAt: now,
    };
  }
  if (source.type === "workbook_cell" || source.type === "workbook_range") {
    const normalizedRef = normalizeWorkbookRef(source.ref);
    const selectedValues =
      workbookSelectionValuesByRef[source.ref] ??
      (normalizedRef ? workbookSelectionValuesByRef[normalizedRef] : undefined);
    if (selectedValues) {
      const rawValue =
        source.type === "workbook_cell"
          ? (selectedValues[0]?.[0] ?? "")
          : selectedValues;

      return {
        referenceId,
        status: "resolved",
        displayValue:
          source.type === "workbook_range"
            ? formatRangePreview(rawValue)
            : formatUnknownPreviewValue(rawValue),
        rawValue,
        updatedAt: now,
      };
    }

    if (!workbookPreview) {
      return {
        referenceId,
        status: "missing_source",
        displayValue: formatReferenceFallback(referenceId),
        updatedAt: now,
      };
    }

    const resolved = resolveWorkbookPreviewValue(workbookPreview, source.ref);
    if (resolved.status === "error") {
      return {
        referenceId,
        status: "error",
        displayValue: formatReferenceFallback(referenceId),
        updatedAt: now,
      };
    }

    return {
      referenceId,
      status: "resolved",
      displayValue:
        source.type === "workbook_range"
          ? formatRangePreview(resolved.value)
          : formatUnknownPreviewValue(resolved.value),
      rawValue: resolved.value,
      updatedAt: now,
    };
  }

  return {
    referenceId,
    status: "error",
    displayValue: formatReferenceFallback(referenceId),
    updatedAt: now,
  };
}

function resolveRangeCellValue(
  value: unknown,
  rangeCell: RangeCellOffset,
): { status: "resolved"; value: unknown } | { status: "error" } {
  if (!Array.isArray(value)) {
    return { status: "error" };
  }

  const row = value[rangeCell.rowOffset];
  if (!Array.isArray(row) || rangeCell.columnOffset >= row.length) {
    return { status: "error" };
  }

  return { status: "resolved", value: row[rangeCell.columnOffset] };
}

function formatRangePreview(value: unknown) {
  if (!Array.isArray(value)) {
    return formatUnknownPreviewValue(value);
  }

  const rowCount = value.length;
  const columnCount = Array.isArray(value[0]) ? value[0].length : 0;
  if (rowCount === 0 || columnCount === 0) {
    return "Empty range";
  }

  return `${rowCount} × ${columnCount} range`;
}

function formatUnknownPreviewValue(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
