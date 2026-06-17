import { cn } from "@lemma/ui/lib/utils";
import type {
  ComposedRichContent,
  ComposedRichContentNode,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { InlineContentRenderer } from "./inline-content-renderer";

export function RichContentPreview({
  content,
  referencePreviewCache = {},
}: {
  content: ComposedRichContent;
  referencePreviewCache?: ReferencePreviewCache;
}) {
  return (
    <div className="space-y-3 text-sm leading-7 text-foreground [&_li>p]:inline">
      {content.content.map((node, index) => (
        <RichContentNodePreview
          key={`${node.type}-${index}`}
          node={node}
          referencePreviewCache={referencePreviewCache}
        />
      ))}
    </div>
  );
}

function RichContentNodePreview({
  node,
  referencePreviewCache,
}: {
  node: ComposedRichContentNode;
  referencePreviewCache: ReferencePreviewCache;
}) {
  if (node.type === "paragraph" || node.type === "heading") {
    const content = (
      <InlineContentRenderer
        content={node.content}
        mode="preview"
        referencePreviewValues={referencePreviewCache}
      />
    );
    if (node.type === "paragraph") {
      return <p className="leading-7">{content}</p>;
    }
    const HeadingTag = `h${node.level}` as const;
    return (
      <HeadingTag className={getHeadingClassName(node.level)}>
        {content}
      </HeadingTag>
    );
  }

  const ListTag = node.type === "bullet_list" ? "ul" : "ol";
  const listStyle = node.type === "bullet_list" ? "list-disc" : "list-decimal";
  return (
    <ListTag className={cn("my-2 space-y-0.5 pl-6 leading-6", listStyle)}>
      {node.items.map((item, itemIndex) => (
        <li key={itemIndex} className="pl-1 marker:text-muted-foreground">
          {item.content.map((child, childIndex) => (
            <RichContentNodePreview
              key={childIndex}
              node={child}
              referencePreviewCache={referencePreviewCache}
            />
          ))}
        </li>
      ))}
    </ListTag>
  );
}

function getHeadingClassName(level: 1 | 2 | 3) {
  if (level === 1) {
    return "mt-5 border-b pb-1 text-2xl font-semibold leading-9 first:mt-0";
  }
  if (level === 2) {
    return "mt-4 border-b pb-1 text-xl font-semibold leading-8 first:mt-0";
  }
  return "mt-3 text-lg font-semibold leading-7 first:mt-0";
}
