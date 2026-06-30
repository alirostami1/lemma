import type { Question } from "#/domains/questions";
import {
  type ComposedEditorBlock,
  type ComposedPreviewModel,
  tableEditorModelToStaticPreviewModel,
} from "#/domains/questions/authoring";
import { questionBodyToComposedPreviewModel } from "#/domains/questions/authoring/canonical";
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
                label: block.label,
                type: "text",
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
      table: tableEditorModelToStaticPreviewModel(block.table),
      type: "table",
    };
  }
  if (block.type === "response") {
    return {
      id: block.id,
      label: block.label,
      placeholder: block.placeholder,
      responseFieldId: block.responseFieldId,
      type: "response",
    };
  }
  if (block.type === "container") {
    return {
      blocks: block.blocks.map(editorBlockToPresentableBlock),
      containerType: block.containerType,
      id: block.id,
      title: block.title,
      type: "container",
    };
  }
  return block;
}
