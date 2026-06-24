import type {
  QuestionGenerationRun,
  QuestionSet,
} from "#/domains/questions/model";

export type GenerateBlueprintSource = {
  id: string;
  name: string;
  sources: {
    sourceId: string;
    name: string;
    workbookId: string;
  }[];
};

export type GenerateQuestionsDialogInput = {
  count: number;
  targetQuestionSetId: string;
  targetQuestionSetName?: string | null;
};

export type ActiveRunContext = {
  count?: number;
  questionSetId: string;
  questionSetName?: string | null;
  runId: string;
};

export type GenerateQuestionsDialogSource = {
  kind: "saved_blueprint";
  blueprintId: string;
  name: string;
  sources: {
    sourceId: string;
    name: string;
    workbookId: string;
  }[];
};

export type GenerateQuestionsDialogProps = {
  open: boolean;
  source: GenerateQuestionsDialogSource | null;
  questionSets: QuestionSet[];
  questionSetsLoading: boolean;
  questionSetsErrorMessage: string | null;
  questionSetMode: "existing" | "create_new";
  selectedQuestionSetId: string;
  newQuestionSetName: string;
  newQuestionSetDescription: string;
  countInput: string;
  isSubmitting: boolean;
  isGenerateDisabled: boolean;
  countIssue: string | null;
  existingQuestionSetIssue: string | null;
  newQuestionSetNameIssue: string | null;
  submitError: string | null;
  onOpenChange(open: boolean): void;
  onSubmit(): void;
  onQuestionSetValueChange(value: string): void;
  onNewQuestionSetNameChange(value: string): void;
  onNewQuestionSetDescriptionChange(value: string): void;
  onCountInputChange(value: string): void;
};

export type GenerateQuestionsController = {
  generateDialog: GenerateQuestionsDialogProps;
  generationStatus: {
    run: QuestionGenerationRun | null;
    errorMessage: string | null;
    isRetrying: boolean;
    onRetry(): void;
  };
  onGenerateBlueprint(blueprint: GenerateBlueprintSource): void;
};
