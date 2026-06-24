import type { QuestionBlueprintWorkbookSource } from "./model";

export type QuestionBlueprintSource = QuestionBlueprintWorkbookSource & {
  type: "workbook";
};

export type QuestionBlueprintSourceType = QuestionBlueprintSource["type"];

export function toQuestionBlueprintSource(
  source: QuestionBlueprintWorkbookSource,
): QuestionBlueprintSource {
  return {
    type: "workbook",
    ...source,
  };
}

export function toQuestionBlueprintSources(
  sources: readonly QuestionBlueprintWorkbookSource[],
): QuestionBlueprintSource[] {
  return sources.map(toQuestionBlueprintSource);
}
