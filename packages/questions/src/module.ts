import type { DatabasePort } from "@lemma/db";
import { createKyselyOutboxRepository } from "@lemma/events/infrastructure";
import {
  type Clock,
  type CustomQuestionGraderPort,
  type DraftSourceFilePort,
  type IdGenerator,
  QuestionBlueprintDraftService,
  QuestionBlueprintService,
  QuestionGenerationService,
  QuestionGradingService,
  QuestionLibraryService,
  QuestionSetService,
  type WorkbookAccessPort,
  type WorkbookRegistrationPort,
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
  draftSourceFilePort: DraftSourceFilePort;
  workbookRegistrationPort: WorkbookRegistrationPort;
}) {
  const questionsRepository = new KyselyQuestionsRepository(deps.db.executor);
  const questionGradingService = new QuestionGradingService({
    customGraderPort: deps.customQuestionGraderPort,
  });

  const questionSetService = new QuestionSetService({
    clock: deps.clock,
    idGenerator: deps.idGenerator,
    questionsRepository,
  });
  const questionBlueprintService = new QuestionBlueprintService({
    clock: deps.clock,
    questionsRepository,
  });
  const questionBlueprintDraftService = new QuestionBlueprintDraftService({
    clock: deps.clock,
    draftSourceFilePort: deps.draftSourceFilePort,
    idGenerator: deps.idGenerator,
    questionsRepository,
    workbookRegistrationPort: deps.workbookRegistrationPort,
  });
  const questionLibraryService = new QuestionLibraryService({
    clock: deps.clock,
    questionGradingService,
    questionsRepository,
  });

  const questionGenerationService = new QuestionGenerationService({
    clock: deps.clock,
    idGenerator: deps.idGenerator,
    questionGenerationTransaction: {
      transaction: (fn) =>
        deps.db.transaction((tx) =>
          fn({
            outboxRepository: createKyselyOutboxRepository(tx),
            questionsRepository: new KyselyQuestionsRepository(tx),
          }),
        ),
    },
    questionsRepository,
    workbookAccessPort: deps.workbookAccessPort ?? new DenyWorkbookAccessPort(),
  });

  const routes = questionsRoutes({
    questionBlueprintDraftService,
    questionBlueprintService,
    questionGenerationService,
    questionLibraryService,
    questionSetService,
    requireIdentity: deps.requireIdentity,
  });

  return {
    questionBlueprintDraftService,
    questionBlueprintService,
    questionGenerationService,
    questionLibraryService,
    questionSetService,
    routes,
  };
}

export const createQuestionModule = createQuestionsModule;
