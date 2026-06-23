import {
  formatReferenceToken,
  isSimpleReferenceIdentifier,
} from "../reference-names";

export type ComposedInlineContent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "reference";
      referenceId: string;
      rangeCell?: RangeCellOffset;
      fallbackText?: string;
    };

export type RangeCellOffset = {
  rowOffset: number;
  columnOffset: number;
};

const BLUEPRINT_REFERENCE_PATTERN =
  /\{\{\s*\.\s*(?:([A-Za-z][A-Za-z0-9_-]*)|\[\s*"((?:[^"\\]|\\.)*)"\s*\])(?:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\])?\s*\}\}/gu;

export function normalizeReferenceId(input: string) {
  return input.trim().replace(/^\./u, "").trim();
}

export function isValidReferenceId(input: string) {
  return isSimpleReferenceIdentifier(input);
}

export function createTextInlineContent(text: string): ComposedInlineContent[] {
  return text.length > 0 ? [{ text, type: "text" }] : [];
}

export const plainTextToInlineContent = createTextInlineContent;

export function parseInlineBlueprint(input: string): ComposedInlineContent[] {
  const content: ComposedInlineContent[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(BLUEPRINT_REFERENCE_PATTERN)) {
    const [
      raw,
      simpleReferenceId,
      bracketReferenceId,
      rowOffset,
      columnOffset,
    ] = match;
    const startIndex = match.index ?? 0;
    const referenceId = simpleReferenceId
      ? simpleReferenceId
      : decodeBracketReferenceId(bracketReferenceId ?? "");
    if (startIndex > lastIndex) {
      content.push({
        text: input.slice(lastIndex, startIndex),
        type: "text",
      });
    }
    content.push({
      referenceId,
      type: "reference",
      ...(rowOffset === undefined || columnOffset === undefined
        ? {}
        : {
            rangeCell: {
              columnOffset: Number(columnOffset),
              rowOffset: Number(rowOffset),
            },
          }),
    });
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

export function formatInlineBlueprint(content: ComposedInlineContent[]) {
  return content
    .map((item) =>
      item.type === "text" ? item.text : formatInlineReference(item),
    )
    .join("");
}

export function formatInlineReference(
  item: Extract<ComposedInlineContent, { type: "reference" }>,
) {
  return formatReferenceToken(item.referenceId, item.rangeCell);
}

export function inlineContentToPlainText(content: ComposedInlineContent[]) {
  return content
    .map((item) =>
      item.type === "text"
        ? item.text
        : (item.fallbackText ?? item.referenceId),
    )
    .join("");
}

export function extractInlineReferenceIds(content: ComposedInlineContent[]) {
  const ids = new Set<string>();
  for (const item of content) {
    if (item.type === "reference") {
      ids.add(item.referenceId);
    }
  }
  return [...ids];
}

export function replaceInlineReferenceId(
  content: ComposedInlineContent[],
  previousReferenceId: string,
  nextReferenceId: string,
): ComposedInlineContent[] {
  return content.map((item) =>
    item.type === "reference" && item.referenceId === previousReferenceId
      ? {
          ...item,
          referenceId: nextReferenceId,
        }
      : item,
  );
}

function mergeAdjacentText(content: ComposedInlineContent[]) {
  const merged: ComposedInlineContent[] = [];
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
