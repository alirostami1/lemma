import type { ComposedEditorBlock } from "#/domains/questions/authoring";

export function getComposedBlockLabel(block: ComposedEditorBlock): string {
  switch (block.type) {
    case "text":
      return "Text";
    case "rich_text":
      return "Rich text";
    case "response":
      return "Answer";
    case "table":
      return "Table";
    case "container":
      return block.containerType === "page" ? "Page" : "Step";
    case "separator":
      return "Divider";
    default:
      return assertNever(block);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected block type: ${JSON.stringify(value)}`);
}
