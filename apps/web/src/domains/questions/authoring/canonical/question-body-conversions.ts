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
    schemaVersion: 1,
    blocks: body.blocks.map((block) => {
      if (block.type === "text") {
        return {
          id: block.id,
          type: "text" as const,
          content: block.content,
        };
      }
      if (block.type === "rich_text") {
        return {
          id: block.id,
          type: "rich_text" as const,
          content: canonicalRichContentToComposed(block.content),
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
          type: "response" as const,
          responseFieldId: block.responseFieldId,
          label: block.label,
          placeholder: block.placeholder,
        };
      }
      if (block.type === "table") {
        return {
          id: block.id,
          type: "table" as const,
          table: questionTableBlockToPreviewModel(block, body.responseFields),
        };
      }
      throw new Error("Unsupported question body for composed renderer.");
    }),
    responseFields: body.responseFields.map(questionResponseFieldToComposed),
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
