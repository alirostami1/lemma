import { describe, expect, it } from "vitest";
import {
  type ComposedEditorBlock,
  createDefaultTableEditorModel,
  createRichTextBlock,
  createSeparatorBlock,
  createTableBlock,
  createTextBlock,
} from "#/domains/questions/authoring";
import { getComposedBlockLabel } from "./block-labels";

describe("getComposedBlockLabel", () => {
  it("maps block types to product labels", () => {
    const blocks: Array<[ComposedEditorBlock, string]> = [
      [createTextBlock("text_1"), "Text"],
      [createRichTextBlock("rich_text_1"), "Rich text"],
      [
        {
          correctValueSource: { type: "literal", value: "" },
          grading: { mode: "exact" },
          id: "response_1",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
        "Answer",
      ],
      [createTableBlock("table_1", createDefaultTableEditorModel()), "Table"],
      [createSeparatorBlock("separator_1"), "Divider"],
    ];

    for (const [block, label] of blocks) {
      expect(getComposedBlockLabel(block)).toBe(label);
    }
  });

  it("does not surface raw block type names", () => {
    const blocks: ComposedEditorBlock[] = [
      createRichTextBlock("rich_text_1"),
      {
        correctValueSource: { type: "literal", value: "" },
        grading: { mode: "exact" },
        id: "response_1",
        points: 1,
        responseFieldId: "answer_1",
        type: "response",
      },
      createSeparatorBlock("separator_1"),
    ];

    for (const block of blocks) {
      expect(getComposedBlockLabel(block)).not.toBe(block.type);
    }
  });
});
