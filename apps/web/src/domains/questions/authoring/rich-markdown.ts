import type {
  ComposedRichContent,
  ComposedRichContentNode,
  ComposedRichListItem,
} from "./composed-model";
import { formatInlineBlueprint, parseInlineBlueprint } from "./inline-content";
import { normalizeRichContent } from "./rich-content";

export type MarkdownFormat =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList";

type ListKind = "bullet_list" | "ordered_list";

type ParsedListLine = {
  indent: number;
  kind: ListKind;
  text: string;
};

export function richContentToMarkdown(value: ComposedRichContent): string {
  return value.content.map((node) => richNodeToMarkdown(node, 0)).join("\n");
}

export function markdownToRichContent(markdown: string): ComposedRichContent {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const result = parseMarkdownBlocks(lines, 0, 0);
  return normalizeRichContent({
    type: "doc",
    content: result.nodes,
  });
}

export function toggleMarkdownFormat({
  markdown,
  selectionStart,
  selectionEnd,
  format,
}: {
  markdown: string;
  selectionStart: number;
  selectionEnd: number;
  format: MarkdownFormat;
}) {
  const range = getSelectedLineRange(markdown, selectionStart, selectionEnd);
  const before = markdown.slice(0, range.start);
  const selected = markdown.slice(range.start, range.end);
  const after = markdown.slice(range.end);
  const lines = selected.split("\n");
  const active =
    format !== "paragraph" &&
    lines.every((line) => getLineFormat(line) === format || line.trim() === "");
  const nextLines = lines.map((line, index) =>
    applyMarkdownFormatToLine(line, active ? "paragraph" : format, index),
  );
  const nextSelected = nextLines.join("\n");

  return {
    markdown: `${before}${nextSelected}${after}`,
    selectionStart: range.start,
    selectionEnd: range.start + nextSelected.length,
  };
}

export function getMarkdownFormatAtPosition(
  markdown: string,
  position: number,
) {
  const range = getSelectedLineRange(markdown, position, position);
  return getLineFormat(markdown.slice(range.start, range.end));
}

function richNodeToMarkdown(
  node: ComposedRichContentNode,
  indent: number,
): string {
  const prefix = " ".repeat(indent);
  if (node.type === "paragraph") {
    return `${prefix}${formatInlineBlueprint(node.content)}`;
  }
  if (node.type === "heading") {
    return `${prefix}${"#".repeat(node.level)} ${formatInlineBlueprint(
      node.content,
    )}`;
  }
  return listNodeToMarkdown(node, indent);
}

function listNodeToMarkdown(
  node: Extract<ComposedRichContentNode, { type: ListKind }>,
  indent: number,
): string {
  const prefix = " ".repeat(indent);
  return node.items
    .map((item, index) => {
      const marker = node.type === "bullet_list" ? "-" : `${index + 1}.`;
      const firstChild = item.content[0];
      const firstText =
        firstChild?.type === "paragraph"
          ? formatInlineBlueprint(firstChild.content)
          : "";
      const lines = [`${prefix}${marker} ${firstText}`];
      const rest =
        firstChild?.type === "paragraph" ? item.content.slice(1) : item.content;
      for (const child of rest) {
        lines.push(
          child.type === "paragraph"
            ? `${prefix}  ${formatInlineBlueprint(child.content)}`
            : listNodeToMarkdown(child, indent + 2),
        );
      }
      return lines.join("\n");
    })
    .join("\n");
}

function parseMarkdownBlocks(
  lines: string[],
  startIndex: number,
  minIndent: number,
): { nodes: ComposedRichContentNode[]; nextIndex: number } {
  const nodes: ComposedRichContentNode[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const listLine = parseListLine(line);
    if (listLine && listLine.indent >= minIndent) {
      const result = parseMarkdownList(
        lines,
        index,
        listLine.indent,
        listLine.kind,
      );
      nodes.push(result.node);
      index = result.nextIndex;
      continue;
    }
    if (listLine && listLine.indent < minIndent) break;

    const heading = parseHeading(line);
    if (heading) {
      nodes.push({
        type: "heading",
        level: heading.level,
        content: parseInlineBlueprint(heading.text),
      });
    } else {
      nodes.push({
        type: "paragraph",
        content: parseInlineBlueprint(line.trim()),
      });
    }
    index += 1;
  }

  return { nodes, nextIndex: index };
}

function parseMarkdownList(
  lines: string[],
  startIndex: number,
  baseIndent: number,
  kind: ListKind,
): {
  node: Extract<ComposedRichContentNode, { type: ListKind }>;
  nextIndex: number;
} {
  const items: ComposedRichListItem[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const listLine = parseListLine(lines[index] ?? "");
    if (!listLine || listLine.indent < baseIndent) break;
    if (listLine.indent > baseIndent) {
      const previousItem = items.at(-1);
      if (!previousItem) break;
      const nested = parseMarkdownList(
        lines,
        index,
        listLine.indent,
        listLine.kind,
      );
      previousItem.content.push(nested.node);
      index = nested.nextIndex;
      continue;
    }
    if (listLine.kind !== kind) break;

    items.push({
      type: "list_item",
      content: [
        {
          type: "paragraph",
          content: parseInlineBlueprint(listLine.text),
        },
      ],
    });
    index += 1;
  }

  return {
    node: {
      type: kind,
      items,
    } as Extract<ComposedRichContentNode, { type: ListKind }>,
    nextIndex: index,
  };
}

function parseHeading(line: string): { level: 1 | 2 | 3; text: string } | null {
  const match = /^(#{1,3})\s+(.*)$/.exec(line.trim());
  if (!match) return null;
  const marker = match[1] ?? "";
  return {
    level: marker.length as 1 | 2 | 3,
    text: match[2] ?? "",
  };
}

function parseListLine(line: string): ParsedListLine | null {
  const match = /^(\s*)([-*]|\d+[.)])\s+(.*)$/.exec(line);
  if (!match) return null;
  const marker = match[2] ?? "";
  return {
    indent: (match[1] ?? "").length,
    kind: marker === "-" || marker === "*" ? "bullet_list" : "ordered_list",
    text: match[3] ?? "",
  };
}

function getSelectedLineRange(
  markdown: string,
  selectionStart: number,
  selectionEnd: number,
) {
  const start = markdown.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const endLineBreak = markdown.indexOf("\n", selectionEnd);
  const end = endLineBreak === -1 ? markdown.length : endLineBreak;
  return { start, end };
}

function applyMarkdownFormatToLine(
  line: string,
  format: MarkdownFormat,
  index: number,
) {
  if (line.trim().length === 0) return line;
  const stripped = stripMarkdownPrefix(line);
  if (format === "paragraph") return stripped;
  if (format === "heading1") return `# ${stripped}`;
  if (format === "heading2") return `## ${stripped}`;
  if (format === "heading3") return `### ${stripped}`;
  if (format === "bulletList") return `- ${stripped}`;
  return `${index + 1}. ${stripped}`;
}

function stripMarkdownPrefix(line: string) {
  const trimmed = line.trim();
  return trimmed.replace(/^(#{1,6})\s+/, "").replace(/^([-*]|\d+[.)])\s+/, "");
}

function getLineFormat(line: string): MarkdownFormat {
  const trimmed = line.trim();
  if (/^#\s+/.test(trimmed)) return "heading1";
  if (/^##\s+/.test(trimmed)) return "heading2";
  if (/^###\s+/.test(trimmed)) return "heading3";
  if (/^[-*]\s+/.test(trimmed)) return "bulletList";
  if (/^\d+[.)]\s+/.test(trimmed)) return "orderedList";
  return "paragraph";
}
