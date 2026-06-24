import type {
  QuestionBlueprintDraftService,
  QuestionBlueprintService,
  QuestionGenerationService,
  QuestionLibraryService,
  QuestionSetService,
} from "../application/index.js";
import { createQuestionsRoutes } from "../generated/hono/index.js";
import type { RequireIdentity } from "./env.js";
import { createQuestionsHandlers } from "./handlers.js";

export type QuestionsRoutesDeps = {
  requireIdentity: RequireIdentity;
  questionSetService: QuestionSetService;
  questionBlueprintService: QuestionBlueprintService;
  questionBlueprintDraftService: QuestionBlueprintDraftService;
  questionLibraryService: QuestionLibraryService;
  questionGenerationService: QuestionGenerationService;
};

export function questionsRoutes(deps: QuestionsRoutesDeps) {
  return createQuestionsRoutes({
    handlers: createQuestionsHandlers({
      questionBlueprintDraftService: deps.questionBlueprintDraftService,
      questionBlueprintService: deps.questionBlueprintService,
      questionGenerationService: deps.questionGenerationService,
      questionLibraryService: deps.questionLibraryService,
      questionSetService: deps.questionSetService,
    }),
    requireIdentity: deps.requireIdentity,
  });
}
