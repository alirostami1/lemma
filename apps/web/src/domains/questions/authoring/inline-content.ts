import {
  formatInlineBlueprintReference,
  formatInlineBlueprintText,
  type InlineBlueprintContent,
  isSimpleInlineBlueprintReferenceId,
  parseInlineBlueprintText,
} from "@lemma/questions/inline-blueprint";

export type ComposedInlineContent = InlineBlueprintContent;

export type RangeCellOffset = NonNullable<
  Extract<InlineBlueprintContent, { type: "reference" }>["rangeCell"]
>;

export function normalizeReferenceId(input: string) {
  return input.trim().replace(/^\./u, "").trim();
}

export function isValidReferenceId(input: string) {
  return isSimpleInlineBlueprintReferenceId(input);
}

export function createTextInlineContent(text: string): ComposedInlineContent[] {
  return text.length > 0 ? [{ text, type: "text" }] : [];
}

export const plainTextToInlineContent = createTextInlineContent;

export function parseInlineBlueprint(input: string): ComposedInlineContent[] {
  return parseInlineBlueprintText(input);
}

export function formatInlineBlueprint(content: ComposedInlineContent[]) {
  return formatInlineBlueprintText(content);
}

export function formatInlineReference(
  item: Extract<ComposedInlineContent, { type: "reference" }>,
) {
  return formatInlineBlueprintReference(item);
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
