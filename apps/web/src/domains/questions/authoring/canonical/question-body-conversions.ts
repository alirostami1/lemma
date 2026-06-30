import type { QuestionBody } from "#/api/generated/model";
import type {
  ComposedPreviewBlock,
  ComposedPreviewModel,
} from "../composed-model";
import { COMPOSED_AUTHORING_SCHEMA_VERSION } from "../composed-model";
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
    blocks: body.blocks.map((block) =>
      questionBodyBlockToComposedPreviewBlock(block, body.responseFields),
    ),
    responseFields: body.responseFields.map(questionResponseFieldToComposed),
    schemaVersion: COMPOSED_AUTHORING_SCHEMA_VERSION,
  };
}

function questionBodyBlockToComposedPreviewBlock(
  block: QuestionBody["blocks"][number],
  responseFields: QuestionBody["responseFields"],
): ComposedPreviewBlock {
  if (block.kind === "container") {
    return {
      blocks: block.blocks.map((childBlock) =>
        questionBodyBlockToComposedPreviewBlock(childBlock, responseFields),
      ),
      containerType: block.type,
      id: block.id,
      title: block.title,
      type: "container",
    };
  }
  if (block.kind === "complex") {
    return {
      id: block.id,
      table: questionTableBlockToPreviewModel(block, responseFields),
      type: "table" as const,
    };
  }
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
  return {
    id: block.id,
    label: block.label,
    placeholder: block.placeholder,
    responseFieldId: block.responseFieldId,
    type: "response" as const,
  };
}

export function questionBodyToTableBlockPreviewModel(
  body: QuestionBody,
): TableBlockPreviewModel {
  const tableResult = findFirstQuestionTableBlockWithPrompt(body.blocks);
  if (!tableResult) {
    throw new Error("Unsupported question body for table renderer.");
  }

  return {
    ...questionTableBlockToPreviewModel(
      tableResult.tableBlock,
      body.responseFields,
    ),
    prompt: tableResult.promptText,
  };
}

type QuestionBodyBlock = QuestionBody["blocks"][number];
type QuestionTableBlock = Extract<
  QuestionBodyBlock,
  { kind: "complex"; type: "table" }
>;

function findFirstQuestionTableBlockWithPrompt(
  blocks: QuestionBodyBlock[],
): { tableBlock: QuestionTableBlock; promptText: string } | null {
  for (const [index, block] of blocks.entries()) {
    if (block.kind === "complex" && block.type === "table") {
      const previousBlock = blocks[index - 1];
      return {
        promptText: isPromptBlockForTable(previousBlock, block)
          ? renderedContentToText(previousBlock.content)
          : "",
        tableBlock: block,
      };
    }

    if (block.kind === "container") {
      const childResult = findFirstQuestionTableBlockWithPrompt(block.blocks);
      if (childResult) {
        return childResult;
      }
    }
  }

  return null;
}

function isPromptBlockForTable(
  block: QuestionBodyBlock | undefined,
  tableBlock: QuestionTableBlock,
): block is Extract<QuestionBodyBlock, { kind: "primitive"; type: "text" }> {
  if (block?.kind !== "primitive" || block.type !== "text") {
    return false;
  }

  return (
    block.id === `${tableBlock.id}_prompt` ||
    (block.id === "prompt" && tableBlock.id === "table")
  );
}
