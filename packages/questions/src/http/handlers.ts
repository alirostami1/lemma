import { rootOperationLineage } from "@lemma/domain";
import { withHttpErrorHandler } from "@lemma/http";
import type {
  CreateQuestionBlueprintCommand,
  CreateQuestionGenerationRunCommand,
  QuestionBlueprintDraftService,
  QuestionBlueprintService,
  QuestionGenerationService,
  QuestionLibraryService,
  QuestionSetService,
  UpdateQuestionBlueprintCommand,
} from "../application/index.js";
import type { QuestionsHandlerMap } from "../generated/hono/index.js";
import { handleQuestionsError } from "./errors.js";
import {
  presentGrade,
  presentPublishedQuestionBlueprintDraft,
  presentQuestion,
  presentQuestionBlueprint,
  presentQuestionBlueprintAuthoring,
  presentQuestionBlueprintDraft,
  presentQuestionBlueprintDrafts,
  presentQuestionBlueprintEditDraft,
  presentQuestionBlueprints,
  presentQuestionGenerationRun,
  presentQuestionGenerationRuns,
  presentQuestionSet,
  presentQuestionSets,
  presentQuestions,
} from "./presenters.js";

export type QuestionsHandlersDeps = {
  questionSetService: QuestionSetService;
  questionBlueprintService: QuestionBlueprintService;
  questionBlueprintDraftService: QuestionBlueprintDraftService;
  questionLibraryService: QuestionLibraryService;
  questionGenerationService: QuestionGenerationService;
};

function questionsHandler<TKey extends keyof QuestionsHandlerMap>(
  _operation: TKey,
  handler: QuestionsHandlerMap[TKey],
): QuestionsHandlerMap[TKey] {
  return withHttpErrorHandler(handler, handleQuestionsError);
}

export function createQuestionsHandlers(
  deps: QuestionsHandlersDeps,
): QuestionsHandlerMap {
  return {
    attachQuestionBlueprintDraftSourceFile: questionsHandler(
      "attachQuestionBlueprintDraftSourceFile",
      async (c) =>
        c.json(
          presentQuestionBlueprintDraft(
            await deps.questionBlueprintDraftService.attachQuestionBlueprintDraftSourceFile(
              {
                currentUser: c.var.identity,
                draftId: c.req.valid("param").draftId,
                ...c.req.valid("json"),
              },
            ),
          ),
          200,
        ),
    ),
    cancelQuestionGenerationRun: questionsHandler(
      "cancelQuestionGenerationRun",
      async (c) => {
        const { questionGenerationRunId } = c.req.valid("param");
        await deps.questionGenerationService.cancelQuestionGenerationRun({
          currentUser: c.var.identity,
          lineage: rootOperationLineage(c.var.requestId),
          questionGenerationRunId,
        });
        return c.body(null, 204);
      },
    ),
    createQuestionBlueprint: questionsHandler(
      "createQuestionBlueprint",
      async (c) => {
        const body = c.req.valid("json") as Omit<
          CreateQuestionBlueprintCommand,
          "currentUser"
        >;
        return c.json(
          presentQuestionBlueprint(
            await deps.questionBlueprintService.createQuestionBlueprint({
              ...body,
              currentUser: c.var.identity,
            }),
          ),
          201,
        );
      },
    ),
    createQuestionBlueprintDraft: questionsHandler(
      "createQuestionBlueprintDraft",
      async (c) =>
        c.json(
          presentQuestionBlueprintDraft(
            await deps.questionBlueprintDraftService.createQuestionBlueprintDraft(
              {
                currentUser: c.var.identity,
                ...c.req.valid("json"),
              },
            ),
          ),
          201,
        ),
    ),

    createQuestionBlueprintEditDraft: questionsHandler(
      "createQuestionBlueprintEditDraft",
      async (c) => {
        const body = c.req.valid("json");
        const result =
          await deps.questionBlueprintDraftService.createQuestionBlueprintEditDraft(
            {
              currentUser: c.var.identity,
              blueprintId: c.req.valid("param").questionBlueprintId,
              ...body,
            },
          );
        return c.json(
          presentQuestionBlueprintEditDraft(result),
          result.resolution === "created" ? 201 : 200,
        );
      },
    ),
    createQuestionGenerationRun: questionsHandler(
      "createQuestionGenerationRun",
      async (c) => {
        const body = c.req.valid("json") as Omit<
          CreateQuestionGenerationRunCommand,
          "currentUser" | "lineage"
        >;
        return c.json(
          presentQuestionGenerationRun(
            await deps.questionGenerationService.createQuestionGenerationRun({
              currentUser: c.var.identity,
              lineage: rootOperationLineage(c.var.requestId),
              ...body,
            }),
          ),
          201,
        );
      },
    ),
    createQuestionSet: questionsHandler("createQuestionSet", async (c) => {
      const body = c.req.valid("json");
      return c.json(
        presentQuestionSet(
          await deps.questionSetService.createQuestionSet({
            currentUser: c.var.identity,
            ...body,
          }),
        ),
        201,
      );
    }),
    deleteQuestion: questionsHandler("deleteQuestion", async (c) => {
      const { questionId } = c.req.valid("param");
      await deps.questionLibraryService.deleteQuestion({
        currentUser: c.var.identity,
        questionId,
      });
      return c.body(null, 204);
    }),
    deleteQuestionBlueprint: questionsHandler(
      "deleteQuestionBlueprint",
      async (c) => {
        const { questionBlueprintId } = c.req.valid("param");
        await deps.questionBlueprintService.deleteQuestionBlueprint({
          currentUser: c.var.identity,
          questionBlueprintId,
        });
        return c.body(null, 204);
      },
    ),
    deleteQuestionSet: questionsHandler("deleteQuestionSet", async (c) => {
      const { questionSetId } = c.req.valid("param");
      await deps.questionSetService.deleteQuestionSet({
        currentUser: c.var.identity,
        questionSetId,
      });
      return c.body(null, 204);
    }),
    discardQuestionBlueprintDraft: questionsHandler(
      "discardQuestionBlueprintDraft",
      async (c) => {
        const body = c.req.valid("json");
        await deps.questionBlueprintDraftService.discardQuestionBlueprintDraft({
          currentUser: c.var.identity,
          draftId: c.req.valid("param").draftId,
          expectedRevision: body.expectedRevision,
        });
        return c.body(null, 204);
      },
    ),
    getQuestion: questionsHandler("getQuestion", async (c) => {
      const { questionId } = c.req.valid("param");
      return c.json(
        presentQuestion(
          await deps.questionLibraryService.getQuestion({
            currentUser: c.var.identity,
            questionId,
          }),
        ),
        200,
      );
    }),
    getQuestionBlueprint: questionsHandler(
      "getQuestionBlueprint",
      async (c) => {
        const { questionBlueprintId } = c.req.valid("param");
        return c.json(
          presentQuestionBlueprint(
            await deps.questionBlueprintService.getQuestionBlueprint({
              currentUser: c.var.identity,
              questionBlueprintId,
            }),
          ),
          200,
        );
      },
    ),
    getQuestionBlueprintAuthoring: questionsHandler(
      "getQuestionBlueprintAuthoring",
      async (c) => {
        const { questionBlueprintId } = c.req.valid("param");
        return c.json(
          presentQuestionBlueprintAuthoring(
            await deps.questionBlueprintService.getQuestionBlueprintAuthoring({
              currentUser: c.var.identity,
              questionBlueprintId,
            }),
          ),
          200,
        );
      },
    ),
    getQuestionBlueprintDraft: questionsHandler(
      "getQuestionBlueprintDraft",
      async (c) =>
        c.json(
          presentQuestionBlueprintDraft(
            await deps.questionBlueprintDraftService.getQuestionBlueprintDraft({
              currentUser: c.var.identity,
              draftId: c.req.valid("param").draftId,
            }),
          ),
          200,
        ),
    ),
    getQuestionGenerationRun: questionsHandler(
      "getQuestionGenerationRun",
      async (c) => {
        const { questionGenerationRunId } = c.req.valid("param");
        return c.json(
          presentQuestionGenerationRun(
            await deps.questionGenerationService.getQuestionGenerationRun({
              currentUser: c.var.identity,
              questionGenerationRunId,
            }),
          ),
          200,
        );
      },
    ),
    getQuestionSet: questionsHandler("getQuestionSet", async (c) => {
      const { questionSetId } = c.req.valid("param");
      return c.json(
        presentQuestionSet(
          await deps.questionSetService.getQuestionSet({
            currentUser: c.var.identity,
            questionSetId,
          }),
        ),
        200,
      );
    }),
    gradeQuestion: questionsHandler("gradeQuestion", async (c) => {
      const { questionId } = c.req.valid("param");
      return c.json(
        presentGrade(
          await deps.questionLibraryService.gradeQuestion({
            answer: c.req.valid("json").answer,
            currentUser: c.var.identity,
            questionId,
          }),
        ),
        200,
      );
    }),
    listQuestionBlueprintDrafts: questionsHandler(
      "listQuestionBlueprintDrafts",
      async (c) => {
        const query = c.req.valid("query");
        return c.json(
          presentQuestionBlueprintDrafts(
            await deps.questionBlueprintDraftService.listQuestionBlueprintDrafts(
              {
                currentUser: c.var.identity,
                ...query,
              },
            ),
          ),
          200,
        );
      },
    ),
    listQuestionBlueprints: questionsHandler(
      "listQuestionBlueprints",
      async (c) => {
        const query = c.req.valid("query");
        return c.json(
          presentQuestionBlueprints(
            await deps.questionBlueprintService.listQuestionBlueprints({
              currentUser: c.var.identity,
              ...query,
            }),
          ),
          200,
        );
      },
    ),
    listQuestionGenerationRuns: questionsHandler(
      "listQuestionGenerationRuns",
      async (c) => {
        const query = c.req.valid("query");
        return c.json(
          presentQuestionGenerationRuns(
            await deps.questionGenerationService.listQuestionGenerationRuns({
              currentUser: c.var.identity,
              ...query,
            }),
          ),
          200,
        );
      },
    ),
    listQuestionSetQuestions: questionsHandler(
      "listQuestionSetQuestions",
      async (c) => {
        const { questionSetId } = c.req.valid("param");
        const query = c.req.valid("query");
        return c.json(
          presentQuestions(
            await deps.questionSetService.listQuestionSetQuestions({
              currentUser: c.var.identity,
              questionSetId,
              ...query,
            }),
          ),
          200,
        );
      },
    ),
    listQuestionSets: questionsHandler("listQuestionSets", async (c) => {
      const query = c.req.valid("query");
      return c.json(
        presentQuestionSets(
          await deps.questionSetService.listQuestionSets({
            currentUser: c.var.identity,
            ...query,
          }),
        ),
        200,
      );
    }),
    listQuestions: questionsHandler("listQuestions", async (c) => {
      const query = c.req.valid("query");
      return c.json(
        presentQuestions(
          await deps.questionLibraryService.listQuestions({
            currentUser: c.var.identity,
            ...query,
          }),
        ),
        200,
      );
    }),
    publishQuestionBlueprintDraft: questionsHandler(
      "publishQuestionBlueprintDraft",
      async (c) => {
        const body = c.req.valid("json");
        return c.json(
          presentPublishedQuestionBlueprintDraft(
            await deps.questionBlueprintDraftService.publishQuestionBlueprintDraft(
              {
                currentUser: c.var.identity,
                draftId: c.req.valid("param").draftId,
                expectedRevision: body.expectedRevision,
                idempotencyKey: body.idempotencyKey,
                lineage: rootOperationLineage(c.get("requestId")),
              },
            ),
          ),
          200,
        );
      },
    ),
    removeQuestionFromSet: questionsHandler(
      "removeQuestionFromSet",
      async (c) => {
        const { questionSetId, questionId } = c.req.valid("param");
        await deps.questionSetService.removeQuestionFromSet({
          currentUser: c.var.identity,
          questionId,
          questionSetId,
        });
        return c.body(null, 204);
      },
    ),
    retryQuestionGenerationRun: questionsHandler(
      "retryQuestionGenerationRun",
      async (c) => {
        const { questionGenerationRunId } = c.req.valid("param");
        return c.json(
          presentQuestionGenerationRun(
            await deps.questionGenerationService.retryQuestionGenerationRun({
              currentUser: c.var.identity,
              lineage: rootOperationLineage(c.var.requestId),
              questionGenerationRunId,
            }),
          ),
          201,
        );
      },
    ),
    updateQuestionBlueprint: questionsHandler(
      "updateQuestionBlueprint",
      async (c) => {
        const { questionBlueprintId } = c.req.valid("param");
        const patch = c.req.valid(
          "json",
        ) as UpdateQuestionBlueprintCommand["patch"];
        return c.json(
          presentQuestionBlueprint(
            await deps.questionBlueprintService.updateQuestionBlueprint({
              currentUser: c.var.identity,
              patch,
              questionBlueprintId,
            }),
          ),
          200,
        );
      },
    ),
    updateQuestionBlueprintDraft: questionsHandler(
      "updateQuestionBlueprintDraft",
      async (c) =>
        c.json(
          presentQuestionBlueprintDraft(
            await deps.questionBlueprintDraftService.updateQuestionBlueprintDraft(
              {
                currentUser: c.var.identity,
                draftId: c.req.valid("param").draftId,
                patch: c.req.valid("json"),
              },
            ),
          ),
          200,
        ),
    ),
    updateQuestionSet: questionsHandler("updateQuestionSet", async (c) => {
      const { questionSetId } = c.req.valid("param");
      return c.json(
        presentQuestionSet(
          await deps.questionSetService.updateQuestionSet({
            currentUser: c.var.identity,
            patch: c.req.valid("json"),
            questionSetId,
          }),
        ),
        200,
      );
    }),
  } as QuestionsHandlerMap;
}
