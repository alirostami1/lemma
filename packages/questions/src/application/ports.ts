import type { JsonValue, OperationLineage } from "@lemma/domain";
import type { OutboxRepository } from "@lemma/events/application";
import type { EventId } from "@lemma/events/domain";
import type { CurrentUser } from "@lemma/identity/application";
import type {
  GradeResult,
  Question,
  QuestionAnswer,
  QuestionBlueprint,
  QuestionBlueprintId,
  QuestionBlueprintVersion,
  QuestionBlueprintVersionId,
  QuestionBlueprintStatus,
  QuestionGenerationRun,
  QuestionGenerationRunId,
  QuestionGenerationRunStatus,
  QuestionId,
  QuestionReferenceSource,
  QuestionSet,
  QuestionSetId,
  QuestionSetQuestion,
  QuestionSetStatus,
  QuestionStatus,
  UserId,
  WorkbookCalculationId,
  WorkbookId,
  WorkbookSnapshotId,
} from "../domain/index.js";

export interface QuestionsRepository {
  findQuestionSetById(id: QuestionSetId): Promise<QuestionSet | null>;
  listQuestionSetsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionSetStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionSet[]>;
  createQuestionSet(set: QuestionSet): Promise<QuestionSet>;
  updateQuestionSet(set: QuestionSet): Promise<QuestionSet | null>;
  removeQuestionFromSet(input: {
    questionSetId: QuestionSetId;
    questionId: QuestionId;
  }): Promise<void>;
  listQuestionsBySetId(input: {
    questionSetId: QuestionSetId;
    limit: number;
    cursor?: Date;
  }): Promise<Question[]>;

  findQuestionBlueprintById(
    id: QuestionBlueprintId,
  ): Promise<QuestionBlueprint | null>;
  findQuestionBlueprintVersionById(
    id: QuestionBlueprintVersionId,
  ): Promise<QuestionBlueprintVersion | null>;
  findCurrentQuestionBlueprintVersion(
    blueprintId: QuestionBlueprintId,
  ): Promise<QuestionBlueprintVersion | null>;
  listQuestionBlueprintVersions(input: {
    blueprintId: QuestionBlueprintId;
  }): Promise<QuestionBlueprintVersion[]>;
  listQuestionBlueprintsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionBlueprintStatus[];
    limit: number;
    cursor?: Date;
    includeSystem?: boolean;
  }): Promise<QuestionBlueprint[]>;
  createQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint>;
  createQuestionBlueprintVersion(
    version: QuestionBlueprintVersion,
  ): Promise<QuestionBlueprintVersion>;
  createQuestionBlueprintWithVersion(input: {
    blueprint: QuestionBlueprint;
    version: QuestionBlueprintVersion;
  }): Promise<QuestionBlueprint>;
  updateQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint | null>;
  updateQuestionBlueprintCurrentVersion(input: {
    blueprintId: QuestionBlueprintId;
    currentVersionId: QuestionBlueprintVersionId;
    workbookId: WorkbookId | null;
    updatedAt: Date;
  }): Promise<QuestionBlueprint | null>;
  updateQuestionBlueprintWithNewVersion(input: {
    blueprint: QuestionBlueprint;
    version: QuestionBlueprintVersion;
  }): Promise<QuestionBlueprint | null>;

  findQuestionById(id: QuestionId): Promise<Question | null>;
  listQuestionsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionStatus[];
    blueprintId?: QuestionBlueprintId;
    generationRunId?: QuestionGenerationRunId;
    limit: number;
    cursor?: Date;
  }): Promise<Question[]>;
  deleteQuestion(question: Question): Promise<Question | null>;

  findQuestionGenerationRunById(
    id: QuestionGenerationRunId,
  ): Promise<QuestionGenerationRun | null>;
  findQuestionGenerationRunByWorkbookCalculationId(
    id: WorkbookCalculationId,
  ): Promise<QuestionGenerationRun | null>;
  listQuestionGenerationRunsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionGenerationRunStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionGenerationRun[]>;
  createQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun>;
  updateQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun | null>;
  completeQuestionGenerationRun(input: {
    run: QuestionGenerationRun;
    questions: readonly Question[];
    memberships: readonly QuestionSetQuestion[];
  }): Promise<QuestionGenerationRun | null>;
}

export interface WorkbookCalculationPort {
  requestCalculation(input: {
    createdByUserId: UserId;
    workbookId: WorkbookId;
    requestedCount: number;
    correlationId?: string | null;
    lineage: OperationLineage;
  }): Promise<{ workbookCalculationId: WorkbookCalculationId }>;
}

export type WorkbookValueSource =
  | { type: "cell"; ref: string }
  | { type: "range"; ref: string }
  | { type: "literal"; value: JsonValue };

export interface WorkbookSnapshotResolverPort {
  resolveValueSource(input: {
    currentUser: CurrentUser;
    workbookSnapshotId: WorkbookSnapshotId;
    source: WorkbookValueSource;
  }): Promise<JsonValue>;
}

export interface WorkbookInternalSnapshotResolverPort {
  resolveValueSource(input: {
    workbookSnapshotId: WorkbookSnapshotId;
    source: WorkbookValueSource;
  }): Promise<JsonValue>;
}

export interface QuestionValueResolverPort {
  resolveReference(input: {
    currentUser?: CurrentUser;
    workbookSnapshotId?: WorkbookSnapshotId | null;
    source: QuestionReferenceSource;
  }): Promise<JsonValue>;
}

export interface CustomQuestionGraderPort {
  grade(input: {
    question: Question;
    answer: QuestionAnswer;
  }): Promise<GradeResult | null> | GradeResult | null;
}

export interface WorkbookAccessPort {
  canUserAccessWorkbook(input: {
    currentUser: CurrentUser;
    workbookId: WorkbookId;
  }): Promise<boolean>;
}

export interface QuestionGenerationTransactionPort {
  transaction<T>(
    fn: (deps: {
      questionsRepository: QuestionsRepository;
      outboxRepository: OutboxRepository;
    }) => Promise<T>,
  ): Promise<T>;
}

export interface IdGenerator {
  questionSetId(): QuestionSetId;
  questionBlueprintId(): QuestionBlueprintId;
  questionBlueprintVersionId(): QuestionBlueprintVersionId;
  questionId(): QuestionId;
  questionGenerationRunId(): QuestionGenerationRunId;
  eventId(): EventId;
}

export interface Clock {
  now(): Date;
}
