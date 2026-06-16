import type { QuestionGenerationRun } from "./model";

export function isQuestionGenerationRunActive(run: QuestionGenerationRun) {
  return (
    run.status === "queued" ||
    run.status === "waiting_for_workbook_calculation" ||
    run.status === "materializing"
  );
}
