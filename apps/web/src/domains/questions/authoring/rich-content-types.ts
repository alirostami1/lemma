import type { ComposedInlineContent } from "./inline-content";

export type ComposedRichContent = {
  type: "doc";
  content: ComposedRichContentNode[];
};

export type ComposedRichContentNode =
  | {
      type: "paragraph";
      content: ComposedInlineContent[];
    }
  | {
      type: "heading";
      level: 1 | 2 | 3;
      content: ComposedInlineContent[];
    }
  | {
      type: "bullet_list";
      items: ComposedRichListItem[];
    }
  | {
      type: "ordered_list";
      items: ComposedRichListItem[];
    };

export type ComposedRichListItem = {
  type: "list_item";
  content: Array<
    | {
        type: "paragraph";
        content: ComposedInlineContent[];
      }
    | {
        type: "bullet_list";
        items: ComposedRichListItem[];
      }
    | {
        type: "ordered_list";
        items: ComposedRichListItem[];
      }
  >;
};
