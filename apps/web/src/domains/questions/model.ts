import type {
  GradeResult,
  QuestionAnswer,
  QuestionBlueprintDocument as AuthoringQuestionBlueprintDocument,
  PublicQuestionBlueprintDocument,
  QuestionBody,
} from "#/api/generated/model";

export type { QuestionAnswer };
export type QuestionGrade = GradeResult;

export type QuestionSetStatus = "active" | "archived" | "deleted";

export type QuestionBlueprintStatus = "active" | "archived" | "deleted";

export type QuestionBlueprintVisibility = "private" | "shared" | "system";

export type QuestionStatus = "active" | "archived" | "deleted";

export type QuestionGenerationRunStatus =
  | "queued"
  | "waiting_for_workbook_calculation"
  | "materializing"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface WorkbookQuestionSource {
  type: "workbook_snapshot";
  workbookId: string;
  workbookVersionId?: string | null;
  workbookCalculationId?: string | null;
  workbookSnapshotId?: string | null;
}

export interface QuestionProducer {
  schemaVersion: 1;
  compiler: string;
  source?: Record<string, unknown>;
}

export interface QuestionBlueprintVersion {
  id: string;
  versionNumber: number;
  workbookId: string | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface QuestionBlueprintAuthoringVersion {
  id: string;
  versionNumber: number;
  workbookId: string | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface QuestionSet {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  status: QuestionSetStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionBlueprint {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  document: PublicQuestionBlueprintDocument;
  workbookId: string | null;
  currentVersionId?: string;
  currentVersionNumber?: number;
  currentVersion?: QuestionBlueprintVersion;
  visibility: QuestionBlueprintVisibility;
  status: QuestionBlueprintStatus;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionBlueprintAuthoring {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  document: AuthoringQuestionBlueprintDocument;
  workbookId: string | null;
  currentVersionId?: string;
  currentVersionNumber?: number;
  currentVersion?: QuestionBlueprintAuthoringVersion;
  visibility: QuestionBlueprintVisibility;
  status: QuestionBlueprintStatus;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  blueprintId: string;
  blueprintVersionId: string;
  generationRunId: string;
  body: QuestionBody;
  producer: QuestionProducer;
  source: WorkbookQuestionSource | null;
  status: QuestionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionGenerationRun {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  blueprintId: string;
  blueprintVersionId: string;
  targetQuestionSetId: string;
  requestedCount: number;
  source: WorkbookQuestionSource | null;
  status: QuestionGenerationRunStatus;
  result: { questionIds: string[] } | null;
  errorMessage: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListQuestionSetsInput {
  limit?: number;
  cursor?: string;
}

export interface CreateQuestionSetInput {
  name: string;
  description?: string | null;
}

export interface UpdateQuestionSetInput {
  questionSetId: string;
  name?: string;
  description?: string | null;
  status?: QuestionSetStatus;
}

export interface ListQuestionSetItemsInput {
  questionSetId: string;
  limit?: number;
  cursor?: string;
}

export interface GetQuestionInput {
  questionId: string;
}

export interface GradeQuestionInput {
  questionId: string;
  answer: QuestionAnswer;
}

export interface ListQuestionBlueprintsInput {
  limit?: number;
  cursor?: string;
  status?: QuestionBlueprintStatus;
}

export interface GetQuestionBlueprintInput {
  questionBlueprintId: string;
}

export interface CreateQuestionBlueprintInput {
  name: string;
  description?: string | null;
  visibility?: QuestionBlueprintVisibility;
  document: AuthoringQuestionBlueprintDocument;
  workbookId?: string | null;
}

export interface UpdateQuestionBlueprintInput {
  questionBlueprintId: string;
  name?: string;
  description?: string | null;
  visibility?: QuestionBlueprintVisibility;
  document?: AuthoringQuestionBlueprintDocument;
  workbookId?: string | null;
  status?: QuestionBlueprintStatus;
}

export type CreateQuestionGenerationRunInput =
  {
    targetQuestionSetId: string;
    count: number;
    blueprintId: string;
    blueprintVersionId?: string | null;
    sourceWorkbookId?: string | null;
    source?: CreateWorkbookQuestionSourceInput | null;
  };

export interface CreateWorkbookQuestionSourceInput {
  type: "workbook_snapshot";
  workbookId: string;
}

export interface GetQuestionGenerationRunInput {
  questionGenerationRunId: string;
}

export interface RetryQuestionGenerationRunInput {
  questionGenerationRunId: string;
  questionSetId?: string | null;
}

export interface QuestionSetsPage {
  questionSets: QuestionSet[];
  nextCursor: string | null;
}

export interface QuestionSetResult {
  questionSet: QuestionSet;
}

export interface QuestionResult {
  question: Question;
}

export interface QuestionGradeResult {
  grade: QuestionGrade;
}

export interface QuestionBlueprintResult {
  questionBlueprint: QuestionBlueprint;
}

export interface QuestionBlueprintAuthoringResult {
  questionBlueprint: QuestionBlueprintAuthoring;
}

export interface QuestionGenerationRunResult {
  questionGenerationRun: QuestionGenerationRun;
}

export interface QuestionBlueprintsPage {
  questionBlueprints: QuestionBlueprint[];
  nextCursor: string | null;
}

export interface QuestionsPage {
  questions: Question[];
  nextCursor: string | null;
}

export interface QuestionGenerationRunsPage {
  questionGenerationRuns: QuestionGenerationRun[];
  nextCursor: string | null;
}
