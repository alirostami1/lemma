import type { DatabasePort } from "@lemma/db";
import { createKyselyOutboxRepository } from "@lemma/events/infrastructure";
import {
  type Clock,
  type CustomQuestionGraderPort,
  type IdGenerator,
  QuestionBlueprintService,
  QuestionGradingService,
  QuestionGenerationService,
  QuestionLibraryService,
  QuestionSetService,
  type WorkbookAccessPort,
} from "./application/index.js";
import type { RequireIdentity } from "./http/index.js";
import { questionsRoutes } from "./http/index.js";
import {
  DenyWorkbookAccessPort,
  KyselyQuestionsRepository,
} from "./infrastructure/index.js";

export function createQuestionsModule(deps: {
  db: DatabasePort;
  requireIdentity: RequireIdentity;
  idGenerator: IdGenerator;
  clock: Clock;
  customQuestionGraderPort?: CustomQuestionGraderPort;
  workbookAccessPort?: WorkbookAccessPort;
}) {
  const questionsRepository = new KyselyQuestionsRepository(deps.db.executor);
  const questionGradingService = new QuestionGradingService({
    customGraderPort: deps.customQuestionGraderPort,
  });

  const questionSetService = new QuestionSetService({
    questionsRepository,
    idGenerator: deps.idGenerator,
    clock: deps.clock,
  });
  const questionBlueprintService = new QuestionBlueprintService({
    questionsRepository,
    idGenerator: deps.idGenerator,
    clock: deps.clock,
  });
  const questionLibraryService = new QuestionLibraryService({
    questionsRepository,
    questionGradingService,
    clock: deps.clock,
  });

  const questionGenerationService = new QuestionGenerationService({
    questionsRepository,
    workbookAccessPort:
      deps.workbookAccessPort ?? new DenyWorkbookAccessPort(),
    questionGenerationTransaction: {
      transaction: (fn) =>
        deps.db.transaction((tx) =>
          fn({
            questionsRepository: new KyselyQuestionsRepository(tx),
            outboxRepository: createKyselyOutboxRepository(tx),
          }),
        ),
    },
    idGenerator: deps.idGenerator,
    clock: deps.clock,
  });

  const routes = questionsRoutes({
    requireIdentity: deps.requireIdentity,
    questionSetService,
    questionBlueprintService,
    questionLibraryService,
    questionGenerationService,
  });

  return {
    routes,
    questionSetService,
    questionBlueprintService,
    questionLibraryService,
    questionGenerationService,
  };
}

export const createQuestionModule = createQuestionsModule;
