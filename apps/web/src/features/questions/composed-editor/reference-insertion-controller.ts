import type { ComposedInlineContent } from "#/domains/questions/authoring";

type InlineReferenceContent = Extract<
  ComposedInlineContent,
  { type: "reference" }
>;

export type InlineInsertionTarget =
  | {
      type: "text";
      index: number;
      start: number;
      end: number;
    }
  | {
      type: "slot";
      index: number;
    };

export function appendReferenceToInlineContent({
  content,
  referenceId,
}: {
  content: ComposedInlineContent[];
  referenceId: string;
}) {
  return appendInlineItemsToInlineContent(content, [
    { referenceId, type: "reference" },
  ]);
}

export function insertReferenceIntoInlineContent({
  content,
  referenceId,
  target,
}: {
  content: ComposedInlineContent[];
  referenceId: string;
  target?: InlineInsertionTarget | null;
}) {
  if (!target) {
    return appendReferenceToInlineContent({ content, referenceId });
  }

  if (target.type === "slot") {
    return [
      ...content.slice(0, target.index),
      { referenceId, type: "reference" } satisfies ComposedInlineContent,
      ...content.slice(target.index),
    ];
  }

  const item = content[target.index];
  if (item?.type !== "text") {
    return appendReferenceToInlineContent({ content, referenceId });
  }

  const start = clampInlineSelectionPosition(target.start, item.text.length);
  const end = clampInlineSelectionPosition(target.end, item.text.length);
  const insertionStart = Math.min(start, end);
  const insertionEnd = Math.max(start, end);
  const before = item.text.slice(0, insertionStart);
  const after = item.text.slice(insertionEnd);
  const nextItems: ComposedInlineContent[] = [];

  if (before.length > 0) {
    nextItems.push({ text: before, type: "text" });
  }
  nextItems.push({ referenceId, type: "reference" });
  if (after.length > 0) {
    nextItems.push({ text: after, type: "text" });
  }

  return [
    ...content.slice(0, target.index),
    ...nextItems,
    ...content.slice(target.index + 1),
  ];
}

function appendInlineItemsToInlineContent(
  content: ComposedInlineContent[],
  items: InlineReferenceContent[],
) {
  if (items.length === 0) {
    return content;
  }

  const nextContent = [...content];
  for (const item of items) {
    const previous = nextContent.at(-1);
    if (
      previous?.type === "text" &&
      previous.text.length > 0 &&
      !/\s$/u.test(previous.text)
    ) {
      nextContent[nextContent.length - 1] = {
        ...previous,
        text: `${previous.text} `,
      };
    }
    nextContent.push({ ...item });
  }
  return nextContent;
}

function clampInlineSelectionPosition(position: number, max: number) {
  if (!Number.isFinite(position)) return max;
  return Math.max(0, Math.min(max, Math.trunc(position)));
}
