import type { CurrentUser } from "@lemma/identity/application";
import type { NotificationChannelAccessPort } from "@lemma/notifications/application";
import {
  ForbiddenQuestionActionError,
  QuestionGenerationRunNotFoundError,
  QuestionSetNotFoundError,
  type QuestionGenerationService,
  type QuestionSetService,
} from "@lemma/questions/application";
import {
  ForbiddenWorkbookActionError,
  WorkbookCalculationNotFoundError,
  type WorkbookCalculationService,
} from "@lemma/workbook/application";

export function createRealtimeChannelAccess(input: {
  questionGenerationService: QuestionGenerationService;
  questionSetService: QuestionSetService;
  workbookCalculationService: WorkbookCalculationService;
}): NotificationChannelAccessPort {
  return {
    async canSubscribe(request) {
      switch (request.accessRequirement.type) {
        case "current_user":
          return request.accessRequirement.userId === request.currentUser.user.id;
        case "question_generation_run":
          return canViewQuestionGenerationRunChannel({
            questionGenerationService: input.questionGenerationService,
            currentUser: request.currentUser,
            questionGenerationRunId:
              request.accessRequirement.questionGenerationRunId,
          });
        case "question_set":
          return canViewQuestionSetChannel({
            questionSetService: input.questionSetService,
            currentUser: request.currentUser,
            questionSetId: request.accessRequirement.questionSetId,
          });
        case "workbook_calculation":
          return canViewWorkbookCalculationChannel({
            workbookCalculationService: input.workbookCalculationService,
            currentUser: request.currentUser,
            workbookCalculationId:
              request.accessRequirement.workbookCalculationId,
          });
      }
    },
  };
}

async function canViewQuestionGenerationRunChannel(input: {
  questionGenerationService: QuestionGenerationService;
  currentUser: CurrentUser;
  questionGenerationRunId: string;
}): Promise<boolean> {
  try {
    await input.questionGenerationService.getQuestionGenerationRun({
      currentUser: input.currentUser,
      questionGenerationRunId: input.questionGenerationRunId,
    });
    return true;
  } catch (error) {
    if (
      error instanceof ForbiddenQuestionActionError ||
      error instanceof QuestionGenerationRunNotFoundError
    ) {
      return false;
    }
    throw error;
  }
}

async function canViewQuestionSetChannel(input: {
  questionSetService: QuestionSetService;
  currentUser: CurrentUser;
  questionSetId: string;
}): Promise<boolean> {
  try {
    await input.questionSetService.getQuestionSet({
      currentUser: input.currentUser,
      questionSetId: input.questionSetId,
    });
    return true;
  } catch (error) {
    if (
      error instanceof ForbiddenQuestionActionError ||
      error instanceof QuestionSetNotFoundError
    ) {
      return false;
    }
    throw error;
  }
}

async function canViewWorkbookCalculationChannel(input: {
  workbookCalculationService: WorkbookCalculationService;
  currentUser: CurrentUser;
  workbookCalculationId: string;
}): Promise<boolean> {
  try {
    await input.workbookCalculationService.getWorkbookCalculation({
      currentUser: input.currentUser,
      workbookCalculationId: input.workbookCalculationId,
    });
    return true;
  } catch (error) {
    if (
      error instanceof ForbiddenWorkbookActionError ||
      error instanceof WorkbookCalculationNotFoundError
    ) {
      return false;
    }
    throw error;
  }
}
