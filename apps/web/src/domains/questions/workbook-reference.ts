export type WorkbookPreviewSheet = {
  name: string;
  rows: string[][];
};

export type WorkbookPreviewForReferences = {
  sheets: WorkbookPreviewSheet[];
};

export type ParsedWorkbookRef = {
  sheetName: string;
  range: string;
  startColumnIndex: number;
  startRowIndex: number;
  endColumnIndex: number;
  endRowIndex: number;
  hasRange: boolean;
};

export function parseWorkbookRef(ref: string): ParsedWorkbookRef | null {
  const sheetAndRange = splitWorkbookRef(ref);
  if (!sheetAndRange) {
    return null;
  }

  const parsedRange = parseWorkbookRange(sheetAndRange.range);
  if (!parsedRange) {
    return null;
  }

  return {
    sheetName: sheetAndRange.sheetName,
    range: sheetAndRange.range,
    ...parsedRange,
  };
}

export function normalizeWorkbookRef(ref: string): string | null {
  const parsedRef = parseWorkbookRef(ref);
  if (!parsedRef) {
    return null;
  }

  const startCell = `${columnIndexToLabel(parsedRef.startColumnIndex)}${
    parsedRef.startRowIndex + 1
  }`;
  const endCell = `${columnIndexToLabel(parsedRef.endColumnIndex)}${
    parsedRef.endRowIndex + 1
  }`;

  return `${formatWorkbookSheetName(
    parsedRef.sheetName,
    true,
  )}!${startCell}:${endCell}`;
}

export function resolveWorkbookValue(
  preview: WorkbookPreviewForReferences | null,
  ref: string,
) {
  if (!preview) {
    return "";
  }

  const resolved = resolveWorkbookPreviewValue(preview, ref);
  return resolved.status === "resolved" ? resolved.value : "";
}

export function resolveWorkbookPreviewValue(
  workbookPreview: WorkbookPreviewForReferences,
  ref: string,
): { status: "resolved"; value: unknown } | { status: "error" } {
  const parsedRef = parseWorkbookRef(ref);
  if (!parsedRef) {
    return { status: "error" };
  }

  const sheet = workbookPreview.sheets.find(
    (candidate) => candidate.name === parsedRef.sheetName,
  );
  if (!sheet) {
    return { status: "error" };
  }

  const values: string[][] = [];
  for (
    let rowIndex = parsedRef.startRowIndex;
    rowIndex <= parsedRef.endRowIndex;
    rowIndex += 1
  ) {
    const row = sheet.rows[rowIndex] ?? [];
    const rowValues: string[] = [];
    for (
      let columnIndex = parsedRef.startColumnIndex;
      columnIndex <= parsedRef.endColumnIndex;
      columnIndex += 1
    ) {
      rowValues.push(row[columnIndex] ?? "");
    }
    values.push(rowValues);
  }

  if (values.length === 1 && values[0]?.length === 1) {
    return { status: "resolved", value: values[0][0] ?? "" };
  }

  return { status: "resolved", value: values };
}

export function getWorkbookCellRefAtOffset(input: {
  rangeRef: string;
  rowOffset: number;
  columnOffset: number;
}): string | null {
  const parsed = parseWorkbookRef(input.rangeRef);
  if (!parsed) {
    return null;
  }

  const rowIndex = parsed.startRowIndex + input.rowOffset;
  const columnIndex = parsed.startColumnIndex + input.columnOffset;
  if (
    rowIndex < parsed.startRowIndex ||
    columnIndex < parsed.startColumnIndex ||
    rowIndex > parsed.endRowIndex ||
    columnIndex > parsed.endColumnIndex
  ) {
    return null;
  }

  return `${formatWorkbookSheetName(
    parsed.sheetName,
    input.rangeRef.startsWith("'"),
  )}!${columnIndexToLabel(columnIndex)}${rowIndex + 1}`;
}

export function isWorkbookRangeRef(parsed: ParsedWorkbookRef): boolean {
  return parsed.hasRange;
}

export function formatWorkbookSheetName(
  sheetName: string,
  forceQuoted = false,
) {
  if (!forceQuoted && /^[A-Za-z0-9_]+$/u.test(sheetName)) {
    return sheetName;
  }

  return `'${sheetName.replace(/'/gu, "''")}'`;
}

function splitWorkbookRef(ref: string): {
  sheetName: string;
  range: string;
} | null {
  if (!ref) {
    return null;
  }

  if (!ref.startsWith("'")) {
    const parts = ref.split("!");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    return { sheetName: parts[0], range: parts[1] };
  }

  let index = 1;
  let sheetName = "";
  while (index < ref.length) {
    const char = ref[index];
    if (char === "'") {
      if (ref[index + 1] === "'") {
        sheetName += "'";
        index += 2;
        continue;
      }
      if (ref[index + 1] !== "!") {
        return null;
      }
      const range = ref.slice(index + 2);
      return range ? { sheetName, range } : null;
    }
    sheetName += char;
    index += 1;
  }

  return null;
}

function parseWorkbookRange(
  range: string,
): Omit<ParsedWorkbookRef, "sheetName" | "range"> | null {
  const match = range.match(
    /^\$?([A-Za-z]+)\$?([1-9][0-9]*)(?::\$?([A-Za-z]+)\$?([1-9][0-9]*))?$/u,
  );
  if (!match) {
    return null;
  }

  const startColumnIndex = columnLabelToIndex(match[1].toUpperCase());
  const startRowIndex = Number(match[2]) - 1;
  const endColumnIndex = match[3]
    ? columnLabelToIndex(match[3].toUpperCase())
    : startColumnIndex;
  const endRowIndex = match[4] ? Number(match[4]) - 1 : startRowIndex;

  if (
    startColumnIndex < 0 ||
    startRowIndex < 0 ||
    endColumnIndex < startColumnIndex ||
    endRowIndex < startRowIndex
  ) {
    return null;
  }

  return {
    startColumnIndex,
    startRowIndex,
    endColumnIndex,
    endRowIndex,
    hasRange: match[3] !== undefined,
  };
}

function columnLabelToIndex(label: string) {
  return (
    [...label].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1
  );
}

function columnIndexToLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}
