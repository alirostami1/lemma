import type { DatabaseExecutor } from "@lemma/db";
import type { QuestionsRepository } from "../application/index.js";
import type {
  Question,
  QuestionBlueprint,
  QuestionBlueprintId,
  QuestionBlueprintStatus,
  QuestionBlueprintVersion,
  QuestionBlueprintVersionAsset,
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
  UserId,
  WorkbookCalculationId,
} from "../domain/index.js";
import { KyselyQuestionBlueprintRepository } from "./KyselyQuestionBlueprintRepository.js";
import { KyselyQuestionGenerationRunRepository } from "./KyselyQuestionGenerationRunRepository.js";
import { KyselyQuestionLibraryRepository } from "./KyselyQuestionLibraryRepository.js";
import { KyselyQuestionSetRepository } from "./KyselyQuestionSetRepository.js";

export class KyselyQuestionsRepository implements QuestionsRepository {
  private readonly blueprints: KyselyQuestionBlueprintRepository;
  private readonly generationRuns: KyselyQuestionGenerationRunRepository;
  private readonly questions: KyselyQuestionLibraryRepository;
  private readonly sets: KyselyQuestionSetRepository;

  constructor(db: DatabaseExecutor) {
    this.blueprints = new KyselyQuestionBlueprintRepository(db);
    this.generationRuns = new KyselyQuestionGenerationRunRepository(db);
    this.questions = new KyselyQuestionLibraryRepository(db);
    this.sets = new KyselyQuestionSetRepository(db);
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

  findCurrentQuestionBlueprintVersion(
    blueprintId: QuestionBlueprintId,
  ): Promise<QuestionBlueprintVersion | null> {
    return this.blueprints.findCurrentQuestionBlueprintVersion(blueprintId);
  }

  listQuestionBlueprintVersions(input: {
    blueprintId: QuestionBlueprintId;
  }): Promise<QuestionBlueprintVersion[]> {
    return this.blueprints.listQuestionBlueprintVersions(input);
  }

  listQuestionBlueprintVersionAssets(input: {
    blueprintVersionId: QuestionBlueprintVersionId;
  }): Promise<QuestionBlueprintVersionAsset[]> {
    return this.blueprints.listQuestionBlueprintVersionAssets(input);
  }

  listQuestionBlueprintVersionAssetsByVersionIds(input: {
    blueprintVersionIds: readonly QuestionBlueprintVersionId[];
  }): Promise<QuestionBlueprintVersionAsset[]> {
    return this.blueprints.listQuestionBlueprintVersionAssetsByVersionIds(
      input,
    );
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

  createQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint> {
    return this.blueprints.createQuestionBlueprint(blueprint);
  }

  createQuestionBlueprintVersion(
    version: QuestionBlueprintVersion,
  ): Promise<QuestionBlueprintVersion> {
    return this.blueprints.createQuestionBlueprintVersion(version);
  }

  createQuestionBlueprintWithVersion(input: {
    blueprint: QuestionBlueprint;
    version: QuestionBlueprintVersion;
    assets: readonly QuestionBlueprintVersionAsset[];
  }): Promise<QuestionBlueprint> {
    return this.blueprints.createQuestionBlueprintWithVersion(input);
  }

  updateQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint | null> {
    return this.blueprints.updateQuestionBlueprint(blueprint);
  }

  updateQuestionBlueprintCurrentVersion(input: {
    blueprintId: QuestionBlueprintId;
    currentVersionId: QuestionBlueprintVersionId;
    workbookId: QuestionBlueprint["workbookId"];
    updatedAt: Date;
  }): Promise<QuestionBlueprint | null> {
    return this.blueprints.updateQuestionBlueprintCurrentVersion(input);
  }

  updateQuestionBlueprintWithNewVersion(input: {
    blueprint: QuestionBlueprint;
    version: QuestionBlueprintVersion;
    assets: readonly QuestionBlueprintVersionAsset[];
  }): Promise<QuestionBlueprint | null> {
    return this.blueprints.updateQuestionBlueprintWithNewVersion(input);
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
