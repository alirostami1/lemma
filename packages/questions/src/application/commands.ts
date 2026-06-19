import type { OperationLineage } from "@lemma/domain";
import type { CurrentUser } from "@lemma/identity/application";
import type {
  CreateWorkbookQuestionSourceInput,
  QuestionAnswer,
} from "../domain/index.js";

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

export type CreateQuestionBlueprintCommand = ListCommand & {
  name: string;
  description?: string | null;
  visibility?: string;
  document: unknown;
  workbookId?: string | null;
  workbookSources?: unknown;
};
export type UpdateQuestionBlueprintCommand = ListCommand & {
  questionBlueprintId: string;
  patch: {
    name?: string;
    description?: string | null;
    visibility?: string;
    document?: unknown;
    workbookId?: string | null;
    workbookSources?: unknown;
    status?: string;
  };
};
export type QuestionBlueprintByIdCommand = ListCommand & {
  questionBlueprintId: string;
};
export type QuestionBlueprintVersionByIdCommand =
  QuestionBlueprintByIdCommand & {
    questionBlueprintVersionId: string;
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
  blueprintVersionId?: string | null;
  targetQuestionSetId: string;
  count: number;
  source?: CreateWorkbookQuestionSourceInput | null;
  lineage: OperationLineage;
};

export type QuestionGenerationRunByIdCommand = ListCommand & {
  questionGenerationRunId: string;
};

export type QuestionGenerationRunMutationCommand =
  QuestionGenerationRunByIdCommand & {
    lineage: OperationLineage;
  };
