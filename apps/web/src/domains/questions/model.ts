import type {
  QuestionBlueprintDocument as AuthoringQuestionBlueprintDocument,
  GradeResult,
  PublicQuestionBlueprintDocument,
  QuestionAnswer,
  QuestionBody,
} from "#/api/generated/model";

export type { QuestionAnswer };
export type QuestionGrade = GradeResult;
export type QuestionBlueprintDocument = AuthoringQuestionBlueprintDocument;

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

export interface QuestionProducer {
  compiler: string;
  schemaVersion: 1;
  source?: Record<string, unknown>;
}

export type QuestionBlueprintWorkbookSource = {
  type: "workbook";
  sourceId: string;
  name: string;
  workbookId: string;
};

export type QuestionBlueprintVersionSource = QuestionBlueprintWorkbookSource & {
  fileId: string;
  originalName: string;
  byteSize: number;
  checksumSha256: string;
};

export type QuestionBlueprintDraftSource = {
  type: "workbook";
  sourceId: string;
  name: string;
  fileId: string | null;
  workbookId: string | null;
  status: "local" | "uploaded" | "validated" | "invalid";
  originalName: string | null;
  byteSize: number | null;
  checksumSha256: string | null;
};

export type QuestionBlueprintDraftSourceIntent = {
  type: "workbook";
  sourceId: string;
  name: string;
};

export interface QuestionBlueprintDraft {
  baseVersionId: string | null;
  blueprintId: string | null;
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  discardedAt: Date | null;
  document: AuthoringQuestionBlueprintDocument;
  id: string;
  lastSavedAt: Date;
  name: string;
  ownerUserId: string;
  publishedAt: Date | null;
  publishedVersionId: string | null;
  revision: number;
  sources: QuestionBlueprintDraftSource[];
  status: "draft" | "publishing" | "published" | "discarded";
  updatedAt: Date;
}

export type CreateQuestionBlueprintDraftInput = {
  blueprintId?: string | null;
  name: string;
  description?: string | null;
  document: AuthoringQuestionBlueprintDocument;
  sources: QuestionBlueprintDraftSourceIntent[];
};
export type UpdateQuestionBlueprintDraftInput = {
  draftId: string;
  expectedRevision: number;
  name: string;
  description: string | null;
  document: AuthoringQuestionBlueprintDocument;
  sources: QuestionBlueprintDraftSourceIntent[];
};
export type AttachQuestionBlueprintDraftSourceFileInput = {
  draftId: string;
  expectedRevision: number;
  sourceId: string;
  fileId: string;
};
export type QuestionBlueprintDraftResult = { draft: QuestionBlueprintDraft };
export type CreateQuestionBlueprintEditDraftInput = {
  questionBlueprintId: string;
};
export type QuestionBlueprintEditDraftResult = {
  draft: QuestionBlueprintDraft;
  resolution: "created" | "resumed";
};
export type QuestionBlueprintDraftSummary = {
  id: string;
  blueprintId: string | null;
  name: string;
  description: string | null;
  status: "draft" | "publishing" | "published" | "discarded";
  sourceCount: number;
  updatedAt: Date;
  lastSavedAt: Date;
};
export type QuestionBlueprintDraftSummariesPage = {
  drafts: QuestionBlueprintDraftSummary[];
  nextCursor: string | null;
};
export type QuestionBlueprintDraftsPage = {
  drafts: QuestionBlueprintDraft[];
  nextCursor: string | null;
};
export type PublishQuestionBlueprintDraftResult = {
  draft: QuestionBlueprintDraft;
  questionBlueprint: QuestionBlueprint;
  questionBlueprintVersion: QuestionBlueprintVersion;
};
export type PublishQuestionBlueprintDraftInput = {
  draftId: string;
  expectedRevision: number;
  idempotencyKey: string;
};
export interface ListQuestionBlueprintDraftsInput {
  cursor?: string;
  limit?: number;
  status?: QuestionBlueprintDraftSummary["status"];
}

export interface QuestionSet {
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  id: string;
  name: string;
  ownerUserId: string;
  status: QuestionSetStatus;
  updatedAt: Date;
}

export interface QuestionBlueprint {
  archivedAt: Date | null;
  createdAt: Date;
  createdByUserId: string;
  currentVersionId: string;
  description: string | null;
  document: PublicQuestionBlueprintDocument;
  id: string;
  name: string;
  ownerUserId: string;
  sources: QuestionBlueprintVersionSource[];
  status: QuestionBlueprintStatus;
  updatedAt: Date;
  visibility: QuestionBlueprintVisibility;
}

export interface QuestionBlueprintAuthoring {
  archivedAt: Date | null;
  createdAt: Date;
  createdByUserId: string;
  currentVersionId: string;
  description: string | null;
  document: AuthoringQuestionBlueprintDocument;
  id: string;
  name: string;
  ownerUserId: string;
  sources: QuestionBlueprintVersionSource[];
  status: QuestionBlueprintStatus;
  updatedAt: Date;
  visibility: QuestionBlueprintVisibility;
}

export interface QuestionBlueprintVersion {
  blueprintId: string;
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  document: AuthoringQuestionBlueprintDocument;
  id: string;
  name: string;
  ownerUserId: string;
  parentVersionId: string | null;
  publishedAt: Date;
  sources: QuestionBlueprintVersionSource[];
  versionNumber: number;
}

export interface Question {
  blueprintId: string;
  body: QuestionBody;
  createdAt: Date;
  createdByUserId: string;
  generationRunId: string;
  id: string;
  ownerUserId: string;
  producer: QuestionProducer;
  status: QuestionStatus;
  updatedAt: Date;
}

export interface QuestionGenerationRun {
  attemptNumber: number;
  attempts: number;
  blueprintId: string;
  blueprintVersionId: string;
  createdAt: Date;
  createdByUserId: string;
  errorMessage: string | null;
  finishedAt: Date | null;
  id: string;
  ownerUserId: string;
  requestedCount: number;
  result: { questionIds: string[] } | null;
  retryOfRunId: string | null;
  startedAt: Date | null;
  status: QuestionGenerationRunStatus;
  targetQuestionSetId: string;
  updatedAt: Date;
  workbookCalculationId: string | null;
}

export interface ListQuestionSetsInput {
  cursor?: string;
  limit?: number;
}

export interface CreateQuestionSetInput {
  description?: string | null;
  name: string;
}

export interface UpdateQuestionSetInput {
  description?: string | null;
  name?: string;
  questionSetId: string;
  status?: QuestionSetStatus;
}

export interface ListQuestionSetItemsInput {
  cursor?: string;
  limit?: number;
  questionSetId: string;
}

export interface GetQuestionInput {
  questionId: string;
}

export interface GradeQuestionInput {
  answer: QuestionAnswer;
  questionId: string;
}

export interface ListQuestionBlueprintsInput {
  cursor?: string;
  limit?: number;
  status?: QuestionBlueprintStatus;
}

export interface GetQuestionBlueprintInput {
  questionBlueprintId: string;
}

export type CreateQuestionGenerationRunInput = {
  targetQuestionSetId: string;
  count: number;
  blueprintId: string;
};

export interface GetQuestionGenerationRunInput {
  questionGenerationRunId: string;
}

export interface RetryQuestionGenerationRunInput {
  questionGenerationRunId: string;
  questionSetId?: string | null;
}

export interface QuestionSetsPage {
  nextCursor: string | null;
  questionSets: QuestionSet[];
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
  nextCursor: string | null;
  questionBlueprints: QuestionBlueprint[];
}

export interface QuestionsPage {
  nextCursor: string | null;
  questions: Question[];
}

export interface QuestionGenerationRunsPage {
  nextCursor: string | null;
  questionGenerationRuns: QuestionGenerationRun[];
}
