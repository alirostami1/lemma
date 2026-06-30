export type InlineBlueprintText = {
  type: "text";
  text: string;
};

export type InlineBlueprintReference = {
  type: "reference";
  referenceId: string;
  fallbackText?: string;
  rangeCell?: InlineBlueprintRangeCellOffset;
};

export type InlineBlueprintRangeCellOffset = {
  rowOffset: number;
  columnOffset: number;
};

export type InlineBlueprintContent =
  | InlineBlueprintText
  | InlineBlueprintReference;

const BLUEPRINT_REFERENCE_PATTERN =
  /\{\{\s*\.\s*(?:([A-Za-z][A-Za-z0-9_-]*)|\[\s*"((?:[^"\\]|\\.)*)"\s*\])(?:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\])?\s*\}\}/gu;
const SIMPLE_REFERENCE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/u;

export function parseInlineBlueprintText(
  input: string,
): InlineBlueprintContent[] {
  const content: InlineBlueprintContent[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(BLUEPRINT_REFERENCE_PATTERN)) {
    const reference = parsedReferenceFromMatch(match);
    const raw = match[0];
    const startIndex = match.index ?? 0;

    if (startIndex > lastIndex) {
      content.push({
        text: input.slice(lastIndex, startIndex),
        type: "text",
      });
    }
    content.push(reference);
    lastIndex = startIndex + raw.length;
  }

  if (lastIndex < input.length) {
    content.push({
      text: input.slice(lastIndex),
      type: "text",
    });
  }

  return mergeAdjacentText(content);
}

export function formatInlineBlueprintText(
  content: readonly InlineBlueprintContent[],
): string {
  return content
    .map((part) =>
      part.type === "text" ? part.text : formatInlineBlueprintReference(part),
    )
    .join("");
}

export function formatInlineBlueprintReference(
  reference: InlineBlueprintReference,
): string {
  return formatInlineBlueprintReferenceToken(
    reference.referenceId,
    reference.rangeCell,
  );
}

export function formatInlineBlueprintReferenceToken(
  referenceId: string,
  rangeCell?: InlineBlueprintRangeCellOffset,
): string {
  const reference = isSimpleInlineBlueprintReferenceId(referenceId)
    ? referenceId
    : `[${JSON.stringify(referenceId)}]`;
  const rangeCellSuffix =
    rangeCell === undefined
      ? ""
      : `[${rangeCell.rowOffset},${rangeCell.columnOffset}]`;

  return `{{ .${reference}${rangeCellSuffix} }}`;
}

export function extractInlineBlueprintReferences(
  input: string,
): InlineBlueprintReference[] {
  return parseInlineBlueprintText(input).filter(
    (part): part is InlineBlueprintReference => part.type === "reference",
  );
}

export function isSimpleInlineBlueprintReferenceId(
  referenceId: string,
): boolean {
  return SIMPLE_REFERENCE_ID_PATTERN.test(referenceId);
}

function parsedReferenceFromMatch(
  match: RegExpMatchArray,
): InlineBlueprintReference {
  const simpleReferenceId = match[1];
  const bracketReferenceId = match[2];
  const rowOffset = match[3];
  const columnOffset = match[4];
  const referenceId = simpleReferenceId
    ? simpleReferenceId
    : decodeBracketReferenceId(bracketReferenceId ?? "");

  return {
    referenceId,
    ...(rowOffset === undefined || columnOffset === undefined
      ? {}
      : {
          rangeCell: {
            columnOffset: Number(columnOffset),
            rowOffset: Number(rowOffset),
          },
        }),
    type: "reference",
  };
}

function mergeAdjacentText(
  content: InlineBlueprintContent[],
): InlineBlueprintContent[] {
  const merged: InlineBlueprintContent[] = [];
  for (const item of content) {
    const previous = merged.at(-1);
    if (item.type === "text" && previous?.type === "text") {
      previous.text += item.text;
      continue;
    }
    if (item.type === "text" && item.text.length === 0) {
      continue;
    }
    merged.push(item);
  }
  return merged;
}

function decodeBracketReferenceId(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}
