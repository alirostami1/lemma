import type { OperationLineage } from "@lemma/domain";
import type { CurrentUser } from "@lemma/identity/application";
import type { QuestionAnswer } from "../domain/index.js";

export type ListCommand = {
  currentUser: CurrentUser;
  limit?: number;
  cursor?: string;
};

export type CreateQuestionSetCommand = ListCommand & {
  name: string;
  description?: string | null;
};
export type UpdateQuestionSetCommand = ListCommand & {
  questionSetId: string;
  patch: { name?: string; description?: string | null; status?: string };
};
export type QuestionSetByIdCommand = ListCommand & { questionSetId: string };

export type QuestionBlueprintByIdCommand = ListCommand & {
  questionBlueprintId: string;
};

export type CreateQuestionBlueprintDraftCommand = ListCommand & {
  blueprintId?: string | null;
  name: string;
  description?: string | null;
  document: unknown;
  sources: unknown;
};
export type CreateQuestionBlueprintEditDraftCommand = ListCommand & {
  blueprintId: string;
  mode?: "resume_or_create";
};
export type QuestionBlueprintDraftByIdCommand = ListCommand & {
  draftId: string;
};
export type DiscardQuestionBlueprintDraftCommand =
  QuestionBlueprintDraftByIdCommand & {
    expectedRevision: number;
  };
export type UpdateQuestionBlueprintDraftCommand =
  QuestionBlueprintDraftByIdCommand & {
    patch: {
      expectedRevision: number;
      name: string;
      description: string | null;
      document: unknown;
      sources: unknown;
    };
  };
export type AttachQuestionBlueprintDraftSourceFileCommand =
  QuestionBlueprintDraftByIdCommand & {
    expectedRevision: number;
    sourceId: string;
    fileId: string;
    lineage: OperationLineage;
  };
export type PublishQuestionBlueprintDraftCommand =
  QuestionBlueprintDraftByIdCommand & {
    expectedRevision: number;
    idempotencyKey: string;
    lineage: OperationLineage;
  };

export type QuestionByIdCommand = ListCommand & { questionId: string };
export type GradeQuestionCommand = ListCommand & {
  questionId: string;
  answer: QuestionAnswer | Record<string, unknown>;
};

export type RemoveQuestionFromSetCommand = ListCommand & {
  questionSetId: string;
  questionId: string;
};

export type CreateQuestionGenerationRunCommand = ListCommand & {
  blueprintId: string;
  targetQuestionSetId: string;
  count: number;
  lineage: OperationLineage;
};

export type QuestionGenerationRunByIdCommand = ListCommand & {
  questionGenerationRunId: string;
};

export type QuestionGenerationRunMutationCommand =
  QuestionGenerationRunByIdCommand & {
    lineage: OperationLineage;
  };
