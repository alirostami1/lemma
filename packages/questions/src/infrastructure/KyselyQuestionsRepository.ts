import type { DatabaseExecutor } from "@lemma/db";
import type {
  PublishSourceMaterialization,
  QuestionsRepository,
} from "../application/index.js";
import type {
  Question,
  QuestionBlueprint,
  QuestionBlueprintDraft,
  QuestionBlueprintDraftId,
  QuestionBlueprintDraftStatus,
  QuestionBlueprintId,
  QuestionBlueprintStatus,
  QuestionBlueprintVersion,
  QuestionBlueprintVersionId,
  QuestionGenerationRun,
  QuestionGenerationRunId,
  QuestionGenerationRunStatus,
  QuestionId,
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
} from "../domain/index.js";
import { KyselyQuestionBlueprintDraftRepository } from "./KyselyQuestionBlueprintDraftRepository.js";
import { KyselyQuestionBlueprintRepository } from "./KyselyQuestionBlueprintRepository.js";
import { KyselyQuestionGenerationRunRepository } from "./KyselyQuestionGenerationRunRepository.js";
import { KyselyQuestionLibraryRepository } from "./KyselyQuestionLibraryRepository.js";
import { KyselyQuestionSetRepository } from "./KyselyQuestionSetRepository.js";
import { KyselySourceRepository } from "./KyselySourceRepository.js";

export class KyselyQuestionsRepository implements QuestionsRepository {
  private readonly blueprints: KyselyQuestionBlueprintRepository;
  private readonly blueprintDrafts: KyselyQuestionBlueprintDraftRepository;
  private readonly generationRuns: KyselyQuestionGenerationRunRepository;
  private readonly questions: KyselyQuestionLibraryRepository;
  private readonly sets: KyselyQuestionSetRepository;
  private readonly sources: KyselySourceRepository;

  constructor(db: DatabaseExecutor) {
    this.blueprints = new KyselyQuestionBlueprintRepository(db);
    this.blueprintDrafts = new KyselyQuestionBlueprintDraftRepository(db);
    this.generationRuns = new KyselyQuestionGenerationRunRepository(db);
    this.questions = new KyselyQuestionLibraryRepository(db);
    this.sets = new KyselyQuestionSetRepository(db);
    this.sources = new KyselySourceRepository(db);
  }

  createSourceDocument(document: SourceDocument): Promise<SourceDocument> {
    return this.sources.createSourceDocument(document);
  }

  createSourceRevision(revision: SourceRevision): Promise<SourceRevision> {
    return this.sources.createSourceRevision(revision);
  }

  createSourceArtifact(artifact: SourceArtifact): Promise<SourceArtifact> {
    return this.sources.createSourceArtifact(artifact);
  }

  applyWorkbookValidationResultToDraftSources(input: {
    artifactIds: readonly SourceArtifactId[];
    draftSourceStatus: "validated" | "invalid";
    ownerUserId: UserId;
    updatedAt: Date;
    workbookId: WorkbookId;
  }): Promise<number> {
    return this.blueprintDrafts.applyWorkbookValidationResultToDraftSources(
      input,
    );
  }

  applyWorkbookValidationResultToSourceArtifacts(input: {
    artifactStatus: "valid" | "invalid";
    ownerUserId: UserId;
    updatedAt: Date;
    validationError: string | null;
    workbookId: WorkbookId;
  }): Promise<readonly SourceArtifact[]> {
    return this.sources.applyWorkbookValidationResultToSourceArtifacts(input);
  }

  findSourceDocumentById(id: SourceDocumentId): Promise<SourceDocument | null> {
    return this.sources.findSourceDocumentById(id);
  }

  findSourceRevisionById(id: SourceRevisionId): Promise<SourceRevision | null> {
    return this.sources.findSourceRevisionById(id);
  }

  findSourceArtifactById(id: SourceArtifactId): Promise<SourceArtifact | null> {
    return this.sources.findSourceArtifactById(id);
  }

  findQuestionSetById(id: QuestionSetId): Promise<QuestionSet | null> {
    return this.sets.findQuestionSetById(id);
  }

  listQuestionSetsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionSetStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionSet[]> {
    return this.sets.listQuestionSetsByOwnerUserId(input);
  }

  createQuestionSet(set: QuestionSet): Promise<QuestionSet> {
    return this.sets.createQuestionSet(set);
  }

  updateQuestionSet(set: QuestionSet): Promise<QuestionSet | null> {
    return this.sets.updateQuestionSet(set);
  }

  removeQuestionFromSet(input: {
    questionSetId: QuestionSetId;
    questionId: QuestionId;
  }): Promise<void> {
    return this.sets.removeQuestionFromSet(input);
  }

  listQuestionsBySetId(input: {
    questionSetId: QuestionSetId;
    limit: number;
    cursor?: Date;
  }): Promise<Question[]> {
    return this.sets.listQuestionsBySetId(input);
  }

  findQuestionBlueprintById(
    id: QuestionBlueprintId,
  ): Promise<QuestionBlueprint | null> {
    return this.blueprints.findQuestionBlueprintById(id);
  }

  findQuestionBlueprintVersionById(
    id: QuestionBlueprintVersionId,
  ): Promise<QuestionBlueprintVersion | null> {
    return this.blueprints.findQuestionBlueprintVersionById(id);
  }

  listQuestionBlueprintsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionBlueprintStatus[];
    limit: number;
    cursor?: Date;
    includeSystem?: boolean;
  }): Promise<QuestionBlueprint[]> {
    return this.blueprints.listQuestionBlueprintsByOwnerUserId(input);
  }

  saveQuestionBlueprintLifecycleState(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint | null> {
    return this.blueprints.saveQuestionBlueprintLifecycleState(blueprint);
  }

  findActiveQuestionBlueprintDraftByOwnerAndBlueprint(input: {
    ownerUserId: UserId;
    blueprintId: QuestionBlueprintId;
  }): Promise<QuestionBlueprintDraft | null> {
    return this.blueprintDrafts.findActiveQuestionBlueprintDraftByOwnerAndBlueprint(
      input,
    );
  }

  findQuestionBlueprintDraftById(
    id: QuestionBlueprintDraftId,
  ): Promise<QuestionBlueprintDraft | null> {
    return this.blueprintDrafts.findQuestionBlueprintDraftById(id);
  }

  findQuestionBlueprintDraftByIdForUpdate(
    id: QuestionBlueprintDraftId,
  ): Promise<QuestionBlueprintDraft | null> {
    return this.blueprintDrafts.findQuestionBlueprintDraftByIdForUpdate(id);
  }

  listQuestionBlueprintDraftsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionBlueprintDraftStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionBlueprintDraft[]> {
    return this.blueprintDrafts.listQuestionBlueprintDraftsByOwnerUserId(input);
  }

  createQuestionBlueprintDraft(
    draft: QuestionBlueprintDraft,
  ): Promise<QuestionBlueprintDraft> {
    return this.blueprintDrafts.createQuestionBlueprintDraft(draft);
  }

  createOrResumeQuestionBlueprintEditDraft(input: {
    draft: QuestionBlueprintDraft;
    ownerUserId: UserId;
    blueprintId: QuestionBlueprintId;
  }): Promise<{
    draft: QuestionBlueprintDraft;
    resolution: "created" | "resumed";
  }> {
    return this.blueprintDrafts.createOrResumeQuestionBlueprintEditDraft(input);
  }

  updateQuestionBlueprintDraftWithExpectedRevision(input: {
    draft: QuestionBlueprintDraft;
    expectedRevision: number;
  }): Promise<QuestionBlueprintDraft | null> {
    return this.blueprintDrafts.updateQuestionBlueprintDraftWithExpectedRevision(
      input,
    );
  }

  setSourceDocumentCurrentRevision(input: {
    sourceDocumentId: SourceDocumentId;
    ownerUserId: UserId;
    kind: SourceKind;
    currentRevisionId: SourceRevisionId;
    updatedAt: Date;
  }): Promise<SourceDocument> {
    return this.sources.setSourceDocumentCurrentRevision(input);
  }

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
  } | null> {
    return this.blueprintDrafts.publishQuestionBlueprintDraft(input);
  }

  findQuestionById(id: QuestionId): Promise<Question | null> {
    return this.questions.findQuestionById(id);
  }

  listQuestionsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionStatus[];
    blueprintId?: QuestionBlueprintId;
    generationRunId?: QuestionGenerationRunId;
    limit: number;
    cursor?: Date;
  }): Promise<Question[]> {
    return this.questions.listQuestionsByOwnerUserId(input);
  }

  deleteQuestion(question: Question): Promise<Question | null> {
    return this.questions.deleteQuestion(question);
  }

  findQuestionGenerationRunById(
    id: QuestionGenerationRunId,
  ): Promise<QuestionGenerationRun | null> {
    return this.generationRuns.findQuestionGenerationRunById(id);
  }

  findQuestionGenerationRunByWorkbookCalculationId(
    id: WorkbookCalculationId,
  ): Promise<QuestionGenerationRun | null> {
    return this.generationRuns.findQuestionGenerationRunByWorkbookCalculationId(
      id,
    );
  }

  listQuestionGenerationRunsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionGenerationRunStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<QuestionGenerationRun[]> {
    return this.generationRuns.listQuestionGenerationRunsByOwnerUserId(input);
  }

  createQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun> {
    return this.generationRuns.createQuestionGenerationRun(run);
  }

  updateQuestionGenerationRun(
    run: QuestionGenerationRun,
  ): Promise<QuestionGenerationRun | null> {
    return this.generationRuns.updateQuestionGenerationRun(run);
  }

  completeQuestionGenerationRun(input: {
    run: QuestionGenerationRun;
    questions: readonly Question[];
    memberships: readonly QuestionSetQuestion[];
  }): Promise<QuestionGenerationRun | null> {
    return this.generationRuns.completeQuestionGenerationRun(input);
  }
}
