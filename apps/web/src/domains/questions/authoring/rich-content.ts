import type { ComposedInlineContent } from "./inline-content";
import {
  createTextInlineContent,
  extractInlineReferenceIds,
  inlineContentToPlainText,
  replaceInlineReferenceId,
} from "./inline-content";
import type {
  ComposedRichContent,
  ComposedRichContentNode,
  ComposedRichListItem,
} from "./rich-content-types";

export function createDefaultRichContent(text = ""): ComposedRichContent {
  return {
    content: [
      {
        content: createTextInlineContent(text),
        type: "paragraph",
      },
    ],
    type: "doc",
  };
}

export function richContentFromInlineContent(
  content: ComposedInlineContent[],
): ComposedRichContent {
  return {
    content: [{ content, type: "paragraph" }],
    type: "doc",
  };
}

export function inlineContentFromRichContentIfSimple(
  content: ComposedRichContent,
): ComposedInlineContent[] | null {
  if (content.content.length !== 1) {
    return null;
  }
  const first = content.content[0];
  return first?.type === "paragraph" ? first.content : null;
}

export function richContentToPlainText(content: ComposedRichContent) {
  return content.content.map(richNodeToPlainText).join("\n");
}

export function extractRichReferenceIds(content: ComposedRichContent) {
  const ids = new Set<string>();
  for (const node of content.content) {
    collectRichNodeReferenceIds(node, ids);
  }
  return [...ids];
}

export function normalizeRichContent(
  content: ComposedRichContent,
): ComposedRichContent {
  const normalizedNodes = content.content.map(normalizeRichNode);
  return normalizedNodes.length > 0
    ? { content: normalizedNodes, type: "doc" }
    : createDefaultRichContent();
}

export function replaceRichReferenceId(
  content: ComposedRichContent,
  previousReferenceId: string,
  nextReferenceId: string,
): ComposedRichContent {
  return {
    content: content.content.map((node) =>
      mapRichNode(node, (inline) =>
        replaceInlineReferenceId(inline, previousReferenceId, nextReferenceId),
      ),
    ),
    type: "doc",
  };
}

function richNodeToPlainText(node: ComposedRichContentNode): string {
  if (node.type === "paragraph" || node.type === "heading") {
    return inlineContentToPlainText(node.content);
  }
  return node.items
    .map((item) =>
      item.content
        .map((child) =>
          child.type === "paragraph"
            ? inlineContentToPlainText(child.content)
            : richNodeToPlainText(child),
        )
        .join("\n"),
    )
    .join("\n");
}

function collectRichNodeReferenceIds(
  node: ComposedRichContentNode,
  ids: Set<string>,
) {
  if (node.type === "paragraph" || node.type === "heading") {
    for (const referenceId of extractInlineReferenceIds(node.content)) {
      ids.add(referenceId);
    }
    return;
  }
  for (const item of node.items) {
    for (const child of item.content) {
      if (child.type === "paragraph") {
        for (const referenceId of extractInlineReferenceIds(child.content)) {
          ids.add(referenceId);
        }
        continue;
      }
      collectRichNodeReferenceIds(child, ids);
    }
  }
}

function normalizeRichNode(
  node: ComposedRichContentNode,
): ComposedRichContentNode {
  if (node.type === "paragraph" || node.type === "heading") {
    return {
      ...node,
      content: [...node.content],
    };
  }
  return {
    ...node,
    items: node.items.map(normalizeRichListItem),
  };
}

function normalizeRichListItem(
  item: ComposedRichListItem,
): ComposedRichListItem {
  const content = item.content.map(richNodeToListItemChild);
  return {
    content:
      content.length > 0 ? content : [{ content: [], type: "paragraph" }],
    type: "list_item",
  };
}

type ComposedRichListItemChild = ComposedRichListItem["content"][number];

function mapRichListItemChild(
  child: ComposedRichContentNode,
  mapInline: (content: ComposedInlineContent[]) => ComposedInlineContent[],
): ComposedRichListItemChild {
  return child.type === "paragraph"
    ? {
        content: mapInline(child.content),
        type: "paragraph",
      }
    : richNodeToListItemChild(mapRichNode(child, mapInline));
}

export function richNodeToListItemChild(
  node: ComposedRichContentNode,
): ComposedRichListItemChild {
  if (node.type === "paragraph" || node.type === "heading") {
    return {
      content: [...node.content],
      type: "paragraph",
    };
  }
  return {
    ...node,
    items: node.items.map(normalizeRichListItem),
  };
}

function mapRichNode(
  node: ComposedRichContentNode,
  mapInline: (content: ComposedInlineContent[]) => ComposedInlineContent[],
): ComposedRichContentNode {
  if (node.type === "paragraph" || node.type === "heading") {
    return {
      ...node,
      content: mapInline(node.content),
    };
  }
  return {
    ...node,
    items: node.items.map((item) => mapRichListItem(item, mapInline)),
  };
}

function mapRichListItem(
  item: ComposedRichListItem,
  mapInline: (content: ComposedInlineContent[]) => ComposedInlineContent[],
): ComposedRichListItem {
  return {
    content: item.content.map((child) =>
      mapRichListItemChild(child, mapInline),
    ),
    type: "list_item",
  };
}
