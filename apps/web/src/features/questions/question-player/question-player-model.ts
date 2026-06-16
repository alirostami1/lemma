import {
  tableEditorModelToStaticPreviewModel,
  type ComposedEditorBlock,
  type ComposedPreviewModel,
} from "#/domains/questions/authoring";
import { questionBodyToComposedPreviewModel } from "#/domains/questions/authoring/canonical";
import type { Question } from "#/domains/questions";
import type {
  PresentableQuestion,
  PresentableQuestionBlock,
} from "./question-player-types";

export function questionToPresentableQuestion(
  question: Question,
): PresentableQuestion {
  return composedPreviewToPresentableQuestion(
    questionBodyToComposedPreviewModel(question.body),
  );
}

export function composedPreviewToPresentableQuestion(
  model: ComposedPreviewModel,
): PresentableQuestion {
  return {
    blocks: model.blocks,
    responseFields: model.responseFields,
  };
}

export function editorBlockToPresentableQuestion(
  block: ComposedEditorBlock,
): PresentableQuestion {
  return {
    blocks: [editorBlockToPresentableBlock(block)],
    responseFields:
      block.type === "table"
        ? block.table.responseFields
        : block.type === "response"
          ? [
              {
                id: block.responseFieldId,
                type: "text",
                label: block.label,
              },
            ]
          : [],
  };
}

function editorBlockToPresentableBlock(
  block: ComposedEditorBlock,
): PresentableQuestionBlock {
  if (block.type === "table") {
    return {
      id: block.id,
      type: "table",
      table: tableEditorModelToStaticPreviewModel(block.table),
    };
  }
  if (block.type === "response") {
    return {
      id: block.id,
      type: "response",
      responseFieldId: block.responseFieldId,
      label: block.label,
      placeholder: block.placeholder,
    };
  }
  return block;
}
