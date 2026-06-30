import type { Question } from "./model";

type QuestionBlock = Question["body"]["blocks"][number];

export function getQuestionSummaryText(question: Question): string {
  for (const block of question.body.blocks) {
    const summary = truncateSummary(getBlockSummary(block));
    if (summary) {
      return summary;
    }
  }

  return "Untitled question";
}

function getBlockSummary(block: QuestionBlock): string {
  if (block.kind === "container") {
    return (
      block.blocks
        .map((childBlock) => getBlockSummary(childBlock))
        .find((summary) => summary.length > 0) ?? ""
    );
  }

  switch (block.type) {
    case "text":
      return block.content
        .map((part) => (part.type === "text" ? part.text : part.displayValue))
        .join("");
    case "rich_text":
      return getRichContentText(block.content.content);
    case "input":
      return block.label ?? block.placeholder ?? "Answer input";
    case "table":
      return "Table question";
    case "separator":
      return "";
  }
}

function getRichContentText(nodes: unknown[]): string {
  return nodes
    .flatMap((node) => {
      if (!node || typeof node !== "object" || !("content" in node)) {
        return [];
      }
      const content = node.content;
      if (!Array.isArray(content)) {
        return [];
      }
      return content.flatMap((child) => {
        if (
          child &&
          typeof child === "object" &&
          "text" in child &&
          typeof child.text === "string"
        ) {
          return child.text;
        }
        return getRichContentText([child]);
      });
    })
    .join(" ");
}

function truncateSummary(value: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length > 140
    ? `${normalized.slice(0, 137)}...`
    : normalized;
}
