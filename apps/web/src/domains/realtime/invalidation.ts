import type { QueryClient } from "@tanstack/react-query";
import { questionKeys } from "#/domains/questions/keys";
import { workbookKeys } from "#/domains/workbooks/keys";
import type { RealtimeNotificationMessage } from "./model";

const questionGenerationEventTypes = new Set([
  "question_generation.run_requested.v1",
  "question_generation.run_waiting_for_workbook_calculation.v1",
  "question_generation.run_materializing.v1",
  "question_generation.run_succeeded.v1",
  "question_generation.run_cancelled.v1",
  "question_generation.run_failed.v1",
]);

const workbookValidationEventTypes = new Set([
  "workbook.validation_requested.v1",
  "workbook.validation_succeeded.v1",
  "workbook.validation_failed.v1",
]);

const workbookCalculationEventTypes = new Set([
  "workbook_calculation.requested.v1",
  "workbook_calculation.succeeded.v1",
  "workbook_calculation.failed.v1",
]);

export async function invalidateRealtimeNotification(
  queryClient: QueryClient,
  message: RealtimeNotificationMessage,
): Promise<void> {
  if (questionGenerationEventTypes.has(message.eventType)) {
    await queryClient.invalidateQueries({
      queryKey: questionKeys.generationRunDetail(message.aggregate.id),
    });
    await queryClient.invalidateQueries({
      queryKey: questionKeys.generationRuns(),
    });
    return;
  }

  if (workbookValidationEventTypes.has(message.eventType)) {
    const workbookId =
      typeof message.payload.workbookId === "string"
        ? message.payload.workbookId
        : message.aggregate.id;
    await queryClient.invalidateQueries({
      queryKey: workbookKeys.detail(workbookId),
    });
    await queryClient.invalidateQueries({ queryKey: workbookKeys.lists() });
    return;
  }

  if (workbookCalculationEventTypes.has(message.eventType)) {
    const workbookId =
      typeof message.payload.workbookId === "string"
        ? message.payload.workbookId
        : null;
    const workbookCalculationId =
      typeof message.payload.workbookCalculationId === "string"
        ? message.payload.workbookCalculationId
        : message.aggregate.id;
    if (workbookId) {
      await queryClient.invalidateQueries({
        queryKey: workbookKeys.calculations(workbookId),
      });
    }
    await queryClient.invalidateQueries({
      queryKey: workbookKeys.snapshots(workbookCalculationId),
    });
    await queryClient.invalidateQueries({ queryKey: workbookKeys.lists() });
    return;
  }

  if (message.eventType === "question_set.questions_added.v1") {
    const questionSetId =
      typeof message.payload.questionSetId === "string"
        ? message.payload.questionSetId
        : message.aggregate.id;
    await queryClient.invalidateQueries({
      queryKey: questionKeys.questionSetQuestions(questionSetId),
    });
    await queryClient.invalidateQueries({
      queryKey: questionKeys.questionSetDetail(questionSetId),
    });
    await queryClient.invalidateQueries({
      queryKey: questionKeys.questionSets(),
    });
  }
}
