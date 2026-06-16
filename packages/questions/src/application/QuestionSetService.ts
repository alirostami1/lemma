import {
  createQuestionSet,
  deleteQuestionSet,
  type QuestionSet,
  questionId as toQuestionId,
  questionSetDescription,
  questionSetId as toQuestionSetId,
  questionSetName,
  renameQuestionSet,
  userId as toUserId,
} from "../domain/index.js";
import type {
  CreateQuestionSetCommand,
  ListCommand,
  QuestionSetByIdCommand,
  RemoveQuestionFromSetCommand,
  UpdateQuestionSetCommand,
} from "./commands.js";
import type {
  QuestionSetResult,
  QuestionSetsResult,
  QuestionsResult,
} from "./dto.js";
import {
  decodeListCursor,
  encodeListCursor,
  normalizeListLimit,
} from "./mappers.js";
import {
  canCreateQuestionSet,
  canListQuestionSets,
  canManageQuestionSet,
  canViewQuestionSet,
} from "./policies.js";
import type { Clock, IdGenerator, QuestionsRepository } from "./ports.js";
import {
  assertQuestionAuthorized,
  findQuestionSetByIdOrThrow,
  persistQuestionSet,
} from "./question-application-helpers.js";

export class QuestionSetService {
  constructor(
    private readonly deps: {
      questionsRepository: QuestionsRepository;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  async listQuestionSets(command: ListCommand): Promise<QuestionSetsResult> {
    assertQuestionAuthorized(
      canListQuestionSets(command.currentUser),
      "You cannot list question sets.",
    );
    const limit = normalizeListLimit(command.limit);
    const questionSets =
      await this.deps.questionsRepository.listQuestionSetsByOwnerUserId({
        ownerUserId: toUserId(command.currentUser.user.id),
        statuses: ["active", "archived"],
        limit: limit + 1,
        cursor: decodeListCursor(command.cursor),
      });
    return {
      questionSets: questionSets.slice(0, limit),
      nextCursor:
        questionSets.length > limit
          ? encodeListCursor(questionSets[limit - 1]?.createdAt)
          : null,
    };
  }

  async createQuestionSet(
    command: CreateQuestionSetCommand,
  ): Promise<QuestionSetResult> {
    assertQuestionAuthorized(
      canCreateQuestionSet(command.currentUser),
      "You cannot create question sets.",
    );
    const at = this.deps.clock.now();
    const questionSet = createQuestionSet(
      {
        id: toQuestionSetId(this.deps.idGenerator.questionSetId()),
        ownerUserId: toUserId(command.currentUser.user.id),
        createdByUserId: toUserId(command.currentUser.user.id),
        name: questionSetName(command.name),
        description: questionSetDescription(command.description ?? null),
      },
      at,
    );
    return {
      questionSet:
        await this.deps.questionsRepository.createQuestionSet(questionSet),
    };
  }

  async getQuestionSet(
    command: QuestionSetByIdCommand,
  ): Promise<QuestionSetResult> {
    const questionSet = await this.findQuestionSetById(command.questionSetId);
    assertQuestionAuthorized(
      canViewQuestionSet(command.currentUser, questionSet),
      "You cannot view this question set.",
    );
    return { questionSet };
  }

  async updateQuestionSet(
    command: UpdateQuestionSetCommand,
  ): Promise<QuestionSetResult> {
    const questionSet = await this.findQuestionSetById(command.questionSetId);
    assertQuestionAuthorized(
      canManageQuestionSet(command.currentUser, questionSet),
      "You cannot update this question set.",
    );
    const updated = renameQuestionSet(
      questionSet,
      command.patch,
      this.deps.clock.now(),
    );
    return { questionSet: await this.persistQuestionSet(updated) };
  }

  async deleteQuestionSet(command: QuestionSetByIdCommand): Promise<void> {
    const questionSet = await this.findQuestionSetById(command.questionSetId);
    assertQuestionAuthorized(
      canManageQuestionSet(command.currentUser, questionSet),
      "You cannot delete this question set.",
    );
    await this.persistQuestionSet(
      deleteQuestionSet(questionSet, this.deps.clock.now()),
    );
  }

  async removeQuestionFromSet(
    command: RemoveQuestionFromSetCommand,
  ): Promise<void> {
    const questionSet = await this.findQuestionSetById(command.questionSetId);
    assertQuestionAuthorized(
      canManageQuestionSet(command.currentUser, questionSet),
      "You cannot update this question set.",
    );
    await this.deps.questionsRepository.removeQuestionFromSet({
      questionSetId: toQuestionSetId(command.questionSetId),
      questionId: toQuestionId(command.questionId),
    });
  }

  async listQuestionSetQuestions(
    command: QuestionSetByIdCommand,
  ): Promise<QuestionsResult> {
    const questionSet = await this.findQuestionSetById(command.questionSetId);
    assertQuestionAuthorized(
      canViewQuestionSet(command.currentUser, questionSet),
      "You cannot view this question set.",
    );
    const limit = normalizeListLimit(command.limit);
    const questions = await this.deps.questionsRepository.listQuestionsBySetId({
      questionSetId: questionSet.id,
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

  private findQuestionSetById(id: string) {
    return findQuestionSetByIdOrThrow(this.deps.questionsRepository, id);
  }

  private persistQuestionSet(questionSet: QuestionSet) {
    return persistQuestionSet(this.deps.questionsRepository, questionSet);
  }
}
