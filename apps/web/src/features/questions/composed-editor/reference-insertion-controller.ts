import { getReferenceSyntax } from "./inspector/reference-inspector-helpers";

export type TextInsertionSelection = {
  start: number;
  end: number;
};

export function insertReferenceSyntaxAtSelection({
  text,
  selection,
  referenceId,
}: {
  text: string;
  selection: TextInsertionSelection;
  referenceId: string;
}) {
  const token = getReferenceSyntax(referenceId);
  const start = clampSelectionPosition(selection.start, text.length);
  const end = clampSelectionPosition(selection.end, text.length);
  const insertionStart = Math.min(start, end);
  const insertionEnd = Math.max(start, end);
  const needsLeadingSpace =
    insertionStart > 0 && !/\s/u.test(text[insertionStart - 1] ?? "");
  const needsTrailingSpace =
    insertionEnd < text.length && !/\s/u.test(text[insertionEnd] ?? "");
  const insertedText = `${needsLeadingSpace ? " " : ""}${token}${
    needsTrailingSpace ? " " : ""
  }`;
  const nextText =
    text.slice(0, insertionStart) + insertedText + text.slice(insertionEnd);
  const caret = insertionStart + insertedText.length;

  return {
    selection: {
      end: caret,
      start: caret,
    },
    text: nextText,
  };
}

function clampSelectionPosition(position: number, max: number) {
  if (!Number.isFinite(position)) return max;
  return Math.max(0, Math.min(max, Math.trunc(position)));
}
