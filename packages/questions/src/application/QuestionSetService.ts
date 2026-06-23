import {
  createQuestionSet,
  deleteQuestionSet,
  type QuestionSet,
  questionSetDescription,
  questionSetName,
  renameQuestionSet,
  questionId as toQuestionId,
  questionSetId as toQuestionSetId,
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
        cursor: decodeListCursor(command.cursor),
        limit: limit + 1,
        ownerUserId: toUserId(command.currentUser.user.id),
        statuses: ["active", "archived"],
      });
    return {
      nextCursor:
        questionSets.length > limit
          ? encodeListCursor(questionSets[limit - 1]?.createdAt)
          : null,
      questionSets: questionSets.slice(0, limit),
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
        createdByUserId: toUserId(command.currentUser.user.id),
        description: questionSetDescription(command.description ?? null),
        id: toQuestionSetId(this.deps.idGenerator.questionSetId()),
        name: questionSetName(command.name),
        ownerUserId: toUserId(command.currentUser.user.id),
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
      questionId: toQuestionId(command.questionId),
      questionSetId: toQuestionSetId(command.questionSetId),
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
      cursor: decodeListCursor(command.cursor),
      limit: limit + 1,
      questionSetId: questionSet.id,
    });
    return {
      nextCursor:
        questions.length > limit
          ? encodeListCursor(questions[limit - 1]?.createdAt)
          : null,
      questions: questions.slice(0, limit),
    };
  }

  private findQuestionSetById(id: string) {
    return findQuestionSetByIdOrThrow(this.deps.questionsRepository, id);
  }

  private persistQuestionSet(questionSet: QuestionSet) {
    return persistQuestionSet(this.deps.questionsRepository, questionSet);
  }
}
