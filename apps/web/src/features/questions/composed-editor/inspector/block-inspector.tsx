import type { ReactNode } from "react";
import type { ComposedEditorBlock } from "#/domains/questions/authoring";

export function BlockInspector({
  block,
  children,
}: {
  block: ComposedEditorBlock;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {getBlockInspectorTitle(block)}
        </h3>
        <span className="rounded-md border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
          {getBlockInspectorKind(block)}
        </span>
      </div>
      {children}
    </div>
  );
}

function getBlockInspectorTitle(block: ComposedEditorBlock) {
  if (block.type === "text") return "Text";
  if (block.type === "rich_text") return "Rich text";
  if (block.type === "response") return "Answer";
  if (block.type === "table") return "Table";
  return "Divider";
}

function getBlockInspectorKind(block: ComposedEditorBlock) {
  if (block.type === "text" || block.type === "rich_text") return "Content";
  if (block.type === "response") return "Input";
  if (block.type === "table") return "Table";
  return "Layout";
}
