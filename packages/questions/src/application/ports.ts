import type { JsonValue, OperationLineage } from "@lemma/domain";
import type { OutboxRepository } from "@lemma/events/application";
import type { EventId } from "@lemma/events/domain";
import type { CurrentUser } from "@lemma/identity/application";
import type {
  GradeResult,
  Question,
  QuestionAnswer,
  QuestionBlueprint,
  QuestionBlueprintDraft,
  QuestionBlueprintDraftId,
  QuestionBlueprintDraftStatus,
  QuestionBlueprintId,
  QuestionBlueprintSource,
  QuestionBlueprintStatus,
  QuestionBlueprintVersionId,
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
  attachQuestionBlueprintDraftSourceFile(input: {
    draft: QuestionBlueprintDraft;
    sourceId: string;
    file: DraftSourceFileMetadata;
  }): Promise<QuestionBlueprintDraft | null>;
  completeQuestionGenerationRun(input: {
    run: QuestionGenerationRun;
    questions: readonly Question[];
    memberships: readonly QuestionSetQuestion[];
  }): Promise<QuestionGenerationRun | null>;
  createQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint>;
  createQuestionBlueprintDraft(
    draft: QuestionBlueprintDraft,
  ): Promise<QuestionBlueprintDraft>;
  createQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun>;
  createQuestionSet(set: QuestionSet): Promise<QuestionSet>;
  deleteQuestion(question: Question): Promise<Question | null>;

  findQuestionBlueprintById(
    id: QuestionBlueprintId,
  ): Promise<QuestionBlueprint | null>;
  findQuestionBlueprintDraftById(
    id: QuestionBlueprintDraftId,
  ): Promise<QuestionBlueprintDraft | null>;

  findQuestionById(id: QuestionId): Promise<Question | null>;

  findQuestionGenerationRunById(
    id: QuestionGenerationRunId,
  ): Promise<QuestionGenerationRun | null>;
  findQuestionGenerationRunByWorkbookCalculationId(
    id: WorkbookCalculationId,
  ): Promise<QuestionGenerationRun | null>;
  findQuestionSetById(id: QuestionSetId): Promise<QuestionSet | null>;
  listQuestionBlueprintDraftsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionBlueprintDraftStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionBlueprintDraft[]>;
  listQuestionBlueprintsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionBlueprintStatus[];
    limit: number;
    cursor?: Date;
    includeSystem?: boolean;
  }): Promise<QuestionBlueprint[]>;
  listQuestionGenerationRunsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionGenerationRunStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionGenerationRun[]>;
  listQuestionSetsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionSetStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionSet[]>;
  listQuestionsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionStatus[];
    blueprintId?: QuestionBlueprintId;
    generationRunId?: QuestionGenerationRunId;
    limit: number;
    cursor?: Date;
  }): Promise<Question[]>;
  listQuestionsBySetId(input: {
    questionSetId: QuestionSetId;
    limit: number;
    cursor?: Date;
  }): Promise<Question[]>;
  removeQuestionFromSet(input: {
    questionSetId: QuestionSetId;
    questionId: QuestionId;
  }): Promise<void>;
  updateQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint | null>;
  updateQuestionBlueprintDefinition(input: {
    blueprint: QuestionBlueprint;
    versionId: QuestionBlueprintVersionId;
  }): Promise<QuestionBlueprint | null>;
  updateQuestionBlueprintDraft(
    draft: QuestionBlueprintDraft,
  ): Promise<QuestionBlueprintDraft | null>;
  updateQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun | null>;
  updateQuestionSet(set: QuestionSet): Promise<QuestionSet | null>;
}

export interface WorkbookCalculationPort {
  requestCalculation(input: {
    ownerUserId: UserId;
    createdByUserId: UserId;
    sources: readonly {
      sourceId: string;
      workbookId: WorkbookId;
    }[];
    requestedCount: number;
    correlationId?: string | null;
    lineage: OperationLineage;
  }): Promise<{ workbookCalculationId: WorkbookCalculationId }>;
}

export type WorkbookSnapshotForQuestionGeneration = {
  id: WorkbookSnapshotId;
  calculationId: WorkbookCalculationId;
  sourceId: string;
  workbookId: WorkbookId;
  questionIndex: number;
  snapshotIndex: number;
};

export interface WorkbookSnapshotReadPort {
  listSnapshotMetadataForCalculation(input: {
    workbookCalculationId: WorkbookCalculationId;
  }): Promise<readonly WorkbookSnapshotForQuestionGeneration[]>;
}

export type QuestionGenerationSnapshotKey = `${string}:${number}`;

export function questionGenerationSnapshotKey(input: {
  sourceId: QuestionBlueprintSource["sourceId"];
  questionIndex: number;
}): QuestionGenerationSnapshotKey {
  return `${input.sourceId}:${input.questionIndex}`;
}

export type WorkbookValueSource =
  | { type: "cell"; sourceId: string; ref: string }
  | { type: "range"; sourceId: string; ref: string }
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

export type DraftSourceFileMetadata = {
  fileId: string;
  ownerUserId: UserId;
  originalName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  purpose: string;
};

export interface DraftSourceFilePort {
  getFileMetadata(input: {
    currentUser: CurrentUser;
    fileId: string;
  }): Promise<DraftSourceFileMetadata>;
}

export interface WorkbookRegistrationPort {
  registerWorkbookFromFile(input: {
    currentUser: CurrentUser;
    fileId: string;
    name: string;
    lineage: OperationLineage;
  }): Promise<{ workbookId: WorkbookId }>;
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
  eventId(): EventId;
  questionBlueprintDraftId(): QuestionBlueprintDraftId;
  questionBlueprintId(): QuestionBlueprintId;
  questionBlueprintVersionId(): QuestionBlueprintVersionId;
  questionGenerationRunId(): QuestionGenerationRunId;
  questionId(): QuestionId;
  questionSetId(): QuestionSetId;
}

export interface Clock {
  now(): Date;
}
