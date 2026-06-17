import {
  deleteQuestion,
  questionAnswer,
  questionBlueprintId as toQuestionBlueprintId,
  questionGenerationRunId as toQuestionGenerationRunId,
  questionStatus as toQuestionStatus,
  userId as toUserId,
} from "../domain/index.js";
import type {
  GradeQuestionCommand,
  ListCommand,
  QuestionByIdCommand,
} from "./commands.js";
import type {
  GradeQuestionResult,
  QuestionResult,
  QuestionsResult,
} from "./dto.js";
import { QuestionNotFoundError } from "./errors.js";
import {
  decodeListCursor,
  encodeListCursor,
  normalizeListLimit,
} from "./mappers.js";
import { canManageQuestion, canViewQuestion } from "./policies.js";
import type { Clock, QuestionsRepository } from "./ports.js";
import { QuestionGradingService } from "./QuestionGradingService.js";
import {
  assertQuestionAuthorized,
  findQuestionByIdOrThrow,
} from "./question-application-helpers.js";

export class QuestionLibraryService {
  constructor(
    private readonly deps: {
      questionsRepository: QuestionsRepository;
      questionGradingService?: QuestionGradingService;
      clock: Clock;
    },
  ) {}

  async listQuestions(
    command: ListCommand & {
      status?: string;
      blueprintId?: string;
      generationRunId?: string;
    },
  ): Promise<QuestionsResult> {
    const limit = normalizeListLimit(command.limit);
    const questions =
      await this.deps.questionsRepository.listQuestionsByOwnerUserId({
        ownerUserId: toUserId(command.currentUser.user.id),
        statuses: command.status
          ? [toQuestionStatus(command.status)]
          : ["active", "archived"],
        blueprintId: command.blueprintId
          ? toQuestionBlueprintId(command.blueprintId)
          : undefined,
        generationRunId: command.generationRunId
          ? toQuestionGenerationRunId(command.generationRunId)
          : undefined,
        limit: limit + 1,
        cursor: decodeListCursor(command.cursor),
      });
    return {
      questions: questions.slice(0, limit),
      nextCursor:
        questions.length > limit
          ? encodeListCursor(questions[limit - 1]?.createdAt)
          : null,
    };
  }

  async getQuestion(command: QuestionByIdCommand): Promise<QuestionResult> {
    const question = await this.findQuestionById(command.questionId);
    assertQuestionAuthorized(
      canViewQuestion(command.currentUser, question),
      "You cannot view this question.",
    );
    return { question };
  }

  async deleteQuestion(command: QuestionByIdCommand): Promise<void> {
    const question = await this.findQuestionById(command.questionId);
    assertQuestionAuthorized(
      canManageQuestion(command.currentUser, question),
      "You cannot delete this question.",
    );
    const deleted = deleteQuestion(question, this.deps.clock.now());
    const saved = await this.deps.questionsRepository.deleteQuestion(deleted);
    if (!saved) {
      throw new QuestionNotFoundError();
    }
  }

  async gradeQuestion(
    command: GradeQuestionCommand,
  ): Promise<GradeQuestionResult> {
    const question = await this.findQuestionById(command.questionId);
    assertQuestionAuthorized(
      canViewQuestion(command.currentUser, question),
      "You cannot grade this question.",
    );
    const answer = questionAnswer(command.answer, question.body.responseFields);
    return {
      grade: await (
        this.deps.questionGradingService ?? new QuestionGradingService()
      ).grade({ question, answer }),
    };
  }

  private findQuestionById(id: string) {
    return findQuestionByIdOrThrow(this.deps.questionsRepository, id);
  }
}
