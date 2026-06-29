import { cn } from "@lemma/ui/lib/utils";
import type {
  ComposedInlineContent,
  ComposedReferenceDraft,
  ComposedRichContent,
  ComposedRichContentNode,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { InlineContentRenderer } from "./inline-content-renderer";

type RichContentPreviewBaseProps = {
  content: ComposedRichContent;
  referencePreviewCache?: ReferencePreviewCache;
};

type RichContentPreviewPreviewProps = RichContentPreviewBaseProps & {
  mode: "preview";
  onSelectReference?: never;
  references?: never;
};

type RichContentPreviewEditingProps = RichContentPreviewBaseProps & {
  mode: "editing";
  references?: readonly ComposedReferenceDraft[];
  onSelectReference?: (referenceId: string) => void;
};

export type RichContentPreviewProps =
  | RichContentPreviewPreviewProps
  | RichContentPreviewEditingProps;

type RichInlineRenderSurface =
  | {
      mode: "preview";
      referencePreviewCache: ReferencePreviewCache;
    }
  | {
      mode: "editing";
      referencePreviewCache: ReferencePreviewCache;
      references: readonly ComposedReferenceDraft[];
      onSelectReference?: (referenceId: string) => void;
    };

export function RichContentPreview(props: RichContentPreviewProps) {
  const surface = toRichInlineRenderSurface(props);

  return (
    <div className="space-y-3 text-sm leading-7 text-foreground [&_li>p]:inline">
      {props.content.content.map((node, index) => (
        <RichContentNodePreview
          key={`${node.type}-${index}`}
          node={node}
          surface={surface}
        />
      ))}
    </div>
  );
}

function toRichInlineRenderSurface(
  props: RichContentPreviewProps,
): RichInlineRenderSurface {
  const referencePreviewCache = props.referencePreviewCache ?? {};

  if (props.mode === "editing") {
    return {
      mode: "editing",
      onSelectReference: props.onSelectReference,
      referencePreviewCache,
      references: props.references ?? [],
    };
  }

  return {
    mode: "preview",
    referencePreviewCache,
  };
}

function RichContentNodePreview({
  node,
  surface,
}: {
  node: ComposedRichContentNode;
  surface: RichInlineRenderSurface;
}) {
  if (node.type === "paragraph" || node.type === "heading") {
    const content = renderInlineContent(node.content, surface);
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
        <li className="pl-1 marker:text-muted-foreground" key={itemIndex}>
          {item.content.map((child, childIndex) => (
            <RichContentNodePreview
              key={childIndex}
              node={child}
              surface={surface}
            />
          ))}
        </li>
      ))}
    </ListTag>
  );
}

function renderInlineContent(
  content: ComposedInlineContent[],
  surface: RichInlineRenderSurface,
) {
  if (surface.mode === "editing") {
    return (
      <InlineContentRenderer
        content={content}
        mode="editing"
        onSelectReference={surface.onSelectReference}
        referencePreviewValues={surface.referencePreviewCache}
        references={surface.references}
      />
    );
  }

  return (
    <InlineContentRenderer
      content={content}
      mode="preview"
      referencePreviewValues={surface.referencePreviewCache}
    />
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
