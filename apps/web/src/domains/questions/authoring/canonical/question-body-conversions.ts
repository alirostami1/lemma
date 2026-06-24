import type { QuestionBody } from "#/api/generated/model";
import type { ComposedPreviewModel } from "../composed-model";
import type { TableBlockPreviewModel } from "../table-model";
import {
  canonicalRichContentToComposed,
  questionResponseFieldToComposed,
  renderedContentToText,
} from "./shared";
import { questionTableBlockToPreviewModel } from "./table-conversions";

export function questionBodyToComposedPreviewModel(
  body: QuestionBody,
): ComposedPreviewModel {
  return {
    blocks: body.blocks.map((block) => {
      if (block.type === "text") {
        return {
          content: block.content,
          id: block.id,
          type: "text" as const,
        };
      }
      if (block.type === "rich_text") {
        return {
          content: canonicalRichContentToComposed(block.content),
          id: block.id,
          type: "rich_text" as const,
        };
      }
      if (block.type === "separator") {
        return {
          id: block.id,
          type: "separator" as const,
        };
      }
      if (block.type === "response") {
        return {
          id: block.id,
          label: block.label,
          placeholder: block.placeholder,
          responseFieldId: block.responseFieldId,
          type: "response" as const,
        };
      }
      if (block.type === "table") {
        return {
          id: block.id,
          table: questionTableBlockToPreviewModel(block, body.responseFields),
          type: "table" as const,
        };
      }
      throw new Error("Unsupported question body for composed renderer.");
    }),
    responseFields: body.responseFields.map(questionResponseFieldToComposed),
    schemaVersion: 1,
  };
}

export function questionBodyToTableBlockPreviewModel(
  body: QuestionBody,
): TableBlockPreviewModel {
  const promptBlock = body.blocks.find((block) => block.type === "text");
  const tableBlock = body.blocks.find((block) => block.type === "table");
  if (!tableBlock) {
    throw new Error("Unsupported question body for table renderer.");
  }

  return {
    ...questionTableBlockToPreviewModel(tableBlock, body.responseFields),
    prompt: promptBlock ? renderedContentToText(promptBlock.content) : "",
  };
}
