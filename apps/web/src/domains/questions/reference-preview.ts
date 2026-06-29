import {
  type ComposedEditorModel,
  formatAnswerInputValue,
  type RangeCellOffset,
  type ReferenceSourceDraft,
  type ValueExpression,
} from "./authoring";
import { formatReferenceToken } from "./reference-names";
import { normalizeWorkbookRef } from "./workbook-reference";

export type { WorkbookPreviewForReferences } from "./workbook-reference";

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
export type WorkbookSelectionValuesBySourceAndRef = Record<string, string[][]>;

export function createWorkbookSelectionCacheKey(sourceId: string, ref: string) {
  return `${sourceId}::${ref}`;
}

export function resolveReferencePreviewValues({
  model,
  workbookSelectionValuesBySourceAndRef = {},
  now = Date.now(),
}: {
  model: ComposedEditorModel;
  workbookSelectionValuesBySourceAndRef?: WorkbookSelectionValuesBySourceAndRef;
  now?: number;
}): ReferencePreviewCache {
  const cache: ReferencePreviewCache = {};

  for (const reference of model.references) {
    cache[reference.id] = resolveReferenceSourcePreview({
      now,
      referenceId: reference.id,
      source: reference.source,
      workbookSelectionValuesBySourceAndRef,
    });
  }

  return cache;
}

export function formatCanonicalReferenceTokenFallback(
  referenceId: string,
  rangeCell?: RangeCellOffset,
) {
  return formatReferenceToken(referenceId, rangeCell);
}

export function formatReferenceUnavailableDisplay() {
  return "Added value unavailable";
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
      displayValue: fallbackText ?? formatReferenceUnavailableDisplay(),
      referenceId,
      status: "missing_source",
      updatedAt: now,
    };
  }

  if (!rangeCell) {
    return basePreview;
  }

  if (basePreview.status !== "resolved") {
    return {
      ...basePreview,
      displayValue: fallbackText ?? formatReferenceUnavailableDisplay(),
    };
  }

  const cellValue = resolveRangeCellValue(basePreview.rawValue, rangeCell);
  if (cellValue.status === "error") {
    return {
      displayValue: fallbackText ?? formatReferenceUnavailableDisplay(),
      referenceId,
      status: "error",
      updatedAt: basePreview.updatedAt,
    };
  }

  return {
    displayValue: formatUnknownPreviewValue(cellValue.value),
    rawValue: cellValue.value,
    referenceId,
    status: "resolved",
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
      displayValue: formatAnswerInputValue(value.value),
      rawValue: value.value,
      status: "literal",
    };
  }

  return (
    referencePreviewCache[value.referenceId] ?? {
      displayValue: formatReferenceUnavailableDisplay(),
      referenceId: value.referenceId,
      status: "missing_source",
      updatedAt: now,
    }
  );
}

function resolveReferenceSourcePreview({
  referenceId,
  source,
  workbookSelectionValuesBySourceAndRef,
  now,
}: {
  referenceId: string;
  source: ReferenceSourceDraft;
  workbookSelectionValuesBySourceAndRef: WorkbookSelectionValuesBySourceAndRef;
  now: number;
}): ReferencePreviewValue {
  if (source.type === "literal") {
    return {
      displayValue: formatAnswerInputValue(source.value),
      rawValue: source.value,
      referenceId,
      status: "resolved",
      updatedAt: now,
    };
  }
  if (source.type === "workbook_cell" || source.type === "workbook_range") {
    const normalizedRef = normalizeWorkbookRef(source.ref);
    const selectedValues =
      workbookSelectionValuesBySourceAndRef[
        createWorkbookSelectionCacheKey(source.sourceId, source.ref)
      ] ??
      (normalizedRef
        ? workbookSelectionValuesBySourceAndRef[
            createWorkbookSelectionCacheKey(source.sourceId, normalizedRef)
          ]
        : undefined);
    if (selectedValues) {
      const rawValue =
        source.type === "workbook_cell"
          ? (selectedValues[0]?.[0] ?? "")
          : selectedValues;

      return {
        displayValue:
          source.type === "workbook_range"
            ? formatRangePreview(rawValue)
            : formatUnknownPreviewValue(rawValue),
        rawValue,
        referenceId,
        status: "resolved",
        updatedAt: now,
      };
    }

    return {
      displayValue: formatReferenceUnavailableDisplay(),
      referenceId,
      status: "missing_source",
      updatedAt: now,
    };
  }

  return {
    displayValue: formatReferenceUnavailableDisplay(),
    referenceId,
    status: "error",
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
