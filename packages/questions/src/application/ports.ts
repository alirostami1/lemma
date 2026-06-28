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
  QuestionBlueprintVersion,
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
  SourceArtifact,
  SourceArtifactId,
  SourceDocument,
  SourceDocumentId,
  SourceKind,
  SourceRevision,
  SourceRevisionId,
  UserId,
  WorkbookCalculationId,
  WorkbookId,
  WorkbookSnapshotId,
} from "../domain/index.js";

export interface QuestionsRepository {
  applyWorkbookValidationResultToDraftSources(input: {
    artifactIds: readonly SourceArtifactId[];
    draftSourceStatus: "validated" | "invalid";
    ownerUserId: UserId;
    updatedAt: Date;
    workbookId: WorkbookId;
  }): Promise<number>;
  applyWorkbookValidationResultToSourceArtifacts(input: {
    artifactStatus: "valid" | "invalid";
    ownerUserId: UserId;
    updatedAt: Date;
    validationError: string | null;
    workbookId: WorkbookId;
  }): Promise<readonly SourceArtifact[]>;
  completeQuestionGenerationRun(input: {
    run: QuestionGenerationRun;
    questions: readonly Question[];
    memberships: readonly QuestionSetQuestion[];
  }): Promise<QuestionGenerationRun | null>;
  createOrResumeQuestionBlueprintEditDraft(input: {
    draft: QuestionBlueprintDraft;
    ownerUserId: UserId;
    blueprintId: QuestionBlueprintId;
  }): Promise<{
    draft: QuestionBlueprintDraft;
    resolution: "created" | "resumed";
  }>;
  createQuestionBlueprintDraft(
    draft: QuestionBlueprintDraft,
  ): Promise<QuestionBlueprintDraft>;
  createQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun>;
  createQuestionSet(set: QuestionSet): Promise<QuestionSet>;
  createSourceArtifact(artifact: SourceArtifact): Promise<SourceArtifact>;
  createSourceDocument(document: SourceDocument): Promise<SourceDocument>;
  createSourceRevision(revision: SourceRevision): Promise<SourceRevision>;
  deleteQuestion(question: Question): Promise<Question | null>;
  findActiveQuestionBlueprintDraftByOwnerAndBlueprint(input: {
    ownerUserId: UserId;
    blueprintId: QuestionBlueprintId;
  }): Promise<QuestionBlueprintDraft | null>;

  findQuestionBlueprintById(
    id: QuestionBlueprintId,
  ): Promise<QuestionBlueprint | null>;
  findQuestionBlueprintDraftById(
    id: QuestionBlueprintDraftId,
  ): Promise<QuestionBlueprintDraft | null>;
  findQuestionBlueprintDraftByIdForUpdate(
    id: QuestionBlueprintDraftId,
  ): Promise<QuestionBlueprintDraft | null>;
  findQuestionBlueprintVersionById(
    id: QuestionBlueprintVersionId,
  ): Promise<QuestionBlueprintVersion | null>;

  findQuestionById(id: QuestionId): Promise<Question | null>;

  findQuestionGenerationRunById(
    id: QuestionGenerationRunId,
  ): Promise<QuestionGenerationRun | null>;
  findQuestionGenerationRunByWorkbookCalculationId(
    id: WorkbookCalculationId,
  ): Promise<QuestionGenerationRun | null>;
  findQuestionSetById(id: QuestionSetId): Promise<QuestionSet | null>;
  findSourceArtifactById(id: SourceArtifactId): Promise<SourceArtifact | null>;
  findSourceDocumentById(id: SourceDocumentId): Promise<SourceDocument | null>;
  findSourceRevisionById(id: SourceRevisionId): Promise<SourceRevision | null>;
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
  publishQuestionBlueprintDraft(input: {
    blueprintId: QuestionBlueprintId;
    draftId: QuestionBlueprintDraftId;
    expectedRevision: number;
    idempotencyKey: string;
    ownerUserId: UserId;
    sourceMaterialization: readonly PublishSourceMaterialization[];
    publishedAt: Date;
    versionId: QuestionBlueprintVersionId;
  }): Promise<{
    draft: QuestionBlueprintDraft;
    questionBlueprint: QuestionBlueprint;
    questionBlueprintVersion: QuestionBlueprintVersion;
  } | null>;
  removeQuestionFromSet(input: {
    questionSetId: QuestionSetId;
    questionId: QuestionId;
  }): Promise<void>;
  saveQuestionBlueprintLifecycleState(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint | null>;
  setSourceDocumentCurrentRevision(input: {
    sourceDocumentId: SourceDocumentId;
    ownerUserId: UserId;
    kind: SourceKind;
    currentRevisionId: SourceRevisionId;
    updatedAt: Date;
  }): Promise<SourceDocument>;
  updateQuestionBlueprintDraftWithExpectedRevision(input: {
    draft: QuestionBlueprintDraft;
    expectedRevision: number;
  }): Promise<QuestionBlueprintDraft | null>;
  updateQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun | null>;
  updateQuestionSet(set: QuestionSet): Promise<QuestionSet | null>;
}

export type PublishSourceMaterialization = {
  sourceId: string;
  sourceDocumentId: SourceDocumentId;
  sourceRevisionId: SourceRevisionId;
  sourceArtifactId: SourceArtifactId;
  workbookId: WorkbookId;
};

export type DraftSourceWorkbookMaterialization = {
  attachedAt: Date;
  draftSourceStatus: "uploaded" | "validated" | "invalid";
  sourceDocument: SourceDocument | null;
  sourceDocumentId: SourceDocumentId;
  sourceRevision: SourceRevision;
  sourceRevisionId: SourceRevisionId;
  sourceArtifact: SourceArtifact;
  sourceArtifactId: SourceArtifactId;
  workbookId: WorkbookId;
  advanceDocumentHead: boolean;
};

export type SourceArtifactValidationResult = {
  finalizedArtifactCount: number;
  updatedDraftSourceCount: number;
};

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

export type DraftSourceWorkbookRegistrationResult = {
  workbookId: WorkbookId;
  status: "pending_validation" | "valid" | "invalid" | "archived" | "deleted";
  validationError?: string | null;
};

export interface DraftSourceWorkbookRegistrationPort {
  registerWorkbookFromFile(input: {
    ownerUserId: UserId;
    createdByUserId: UserId;
    fileId: string;
    name: string;
    byteSize: number;
    contentType: string;
    checksumSha256: string;
    originalName: string;
    lineage: OperationLineage;
  }): Promise<DraftSourceWorkbookRegistrationResult>;
}

export interface QuestionBlueprintDraftTransactionPort {
  transaction<T>(
    fn: (deps: {
      questionsRepository: QuestionsRepository;
      workbookRegistrationPort: DraftSourceWorkbookRegistrationPort;
    }) => Promise<T>,
  ): Promise<T>;
}

export interface QuestionGenerationTransactionPort {
  transaction<T>(
    fn: (deps: {
      questionsRepository: QuestionsRepository;
      outboxRepository: OutboxRepository;
    }) => Promise<T>,
  ): Promise<T>;
}

export interface QuestionsTransactionPort {
  transaction<T>(
    fn: (deps: { questionsRepository: QuestionsRepository }) => Promise<T>,
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
  sourceArtifactId(): SourceArtifactId;
  sourceDocumentId(): SourceDocumentId;
  sourceRevisionId(): SourceRevisionId;
}

export interface Clock {
  now(): Date;
}
