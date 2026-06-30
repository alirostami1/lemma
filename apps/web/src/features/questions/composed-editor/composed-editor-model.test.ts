import { describe, expect, it } from "vitest";
import {
  type ComposedEditorModel,
  createResponseBlock,
  createSeparatorBlock,
  createTextBlock,
  reorderComposedBlocks,
} from "#/domains/questions/authoring";

describe("reorderComposedBlocks", () => {
  it("reorders blocks without changing ids", () => {
    const model: ComposedEditorModel = {
      blocks: [
        createTextBlock("text_1", "Prompt"),
        createSeparatorBlock("separator_1"),
        createResponseBlock("response_1", "answer_1"),
      ],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          type: "text",
        },
      ],
      schemaVersion: 2,
    };

    const textBlock = model.blocks[0];
    const separatorBlock = model.blocks[1];
    const responseBlock = model.blocks[2];
    if (!textBlock || !separatorBlock || !responseBlock) {
      throw new Error("Expected default composed model to contain blocks.");
    }

    const reordered = reorderComposedBlocks(model, [
      textBlock,
      responseBlock,
      separatorBlock,
    ]);

    expect(reordered.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
      "separator_1",
    ]);
    expect(reordered.blocks.map((block) => block.id).sort()).toEqual([
      "response_1",
      "separator_1",
      "text_1",
    ]);
  });
});
