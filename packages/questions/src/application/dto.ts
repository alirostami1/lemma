import type {
  GradeResult,
  Question,
  QuestionBlueprint,
  QuestionBlueprintDraft,
  QuestionBlueprintVersion,
  QuestionGenerationRun,
  QuestionSet,
  SourceArtifact,
  SourceRevision,
} from "../domain/index.js";

export type QuestionSetResult = { questionSet: QuestionSet };
export type QuestionSetsResult = {
  questionSets: QuestionSet[];
  nextCursor: string | null;
};
export type QuestionBlueprintResult = {
  questionBlueprint: QuestionBlueprint;
};
export type QuestionBlueprintAuthoringResult = {
  questionBlueprint: QuestionBlueprint;
};
export type QuestionBlueprintsResult = {
  questionBlueprints: QuestionBlueprint[];
  nextCursor: string | null;
};
export type QuestionBlueprintDraftResult = {
  draft: QuestionBlueprintDraft;
};
export type SavedQuestionBlueprintDraftWorkbookSourceRevisionResult = {
  draft: QuestionBlueprintDraft;
  sourceArtifact: SourceArtifact;
  sourceRevision: SourceRevision;
};
export type CreatedQuestionBlueprintDraftWorkbookEditorUploadResult = {
  upload: {
    id: string;
    createdByUserId: string;
    originalName: string;
    contentType: string;
    expectedByteSize: number;
    checksumSha256: string;
    status: "initiated" | "verified" | "failed" | "expired" | "cancelled";
    purpose: string;
    uploadExpiresAt: Date;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  uploadUrl: {
    expiresInSeconds: number;
    method: "PUT";
    url: string;
    headers: Record<string, string>;
  };
};
export type CompletedQuestionBlueprintDraftWorkbookEditorUploadResult = {
  editorOutputFile: {
    id: string;
    originalName: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
  };
};
export type QuestionBlueprintEditDraftResult = QuestionBlueprintDraftResult & {
  resolution: "created" | "resumed";
};
export type QuestionBlueprintDraftsResult = {
  drafts: QuestionBlueprintDraft[];
  nextCursor: string | null;
};
export type PublishedQuestionBlueprintDraftResult = {
  draft: QuestionBlueprintDraft;
  questionBlueprint: QuestionBlueprint;
  questionBlueprintVersion: QuestionBlueprintVersion;
};
export type QuestionResult = { question: Question };
export type QuestionsResult = {
  questions: Question[];
  nextCursor: string | null;
};
export type GradeQuestionResult = { grade: GradeResult };
export type QuestionGenerationRunResultDto = {
  questionGenerationRun: QuestionGenerationRun;
};
export type QuestionGenerationRunsResult = {
  questionGenerationRuns: QuestionGenerationRun[];
  nextCursor: string | null;
};
