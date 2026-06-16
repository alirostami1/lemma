import type {
  QuestionBlueprintService,
  QuestionGenerationService,
  QuestionLibraryService,
  QuestionSetService,
} from "../application/index.js";
import { createQuestionsRoutes } from "../gen/hono/index.js";
import type { RequireIdentity } from "./env.js";
import { createQuestionsHandlers } from "./handlers.js";

export type QuestionsRoutesDeps = {
  requireIdentity: RequireIdentity;
  questionSetService: QuestionSetService;
  questionBlueprintService: QuestionBlueprintService;
  questionLibraryService: QuestionLibraryService;
  questionGenerationService: QuestionGenerationService;
};

export function questionsRoutes(deps: QuestionsRoutesDeps) {
  return createQuestionsRoutes({
    requireIdentity: deps.requireIdentity,
    handlers: createQuestionsHandlers({
      questionSetService: deps.questionSetService,
      questionBlueprintService: deps.questionBlueprintService,
      questionLibraryService: deps.questionLibraryService,
      questionGenerationService: deps.questionGenerationService,
    }),
  });
}
