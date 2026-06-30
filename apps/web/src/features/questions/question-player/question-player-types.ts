import type { QuestionAnswer, QuestionGrade } from "#/domains/questions";
import type {
  ComposedInlineContent,
  ComposedRenderedInlineContent,
  ComposedRichContent,
  TableBlockPreviewModel,
  TableResponseField,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";

export type QuestionPlayerMode =
  | "authoring-preview"
  | "review"
  | "practice"
  | "exam";

export type PresentableQuestionBlock =
  | {
      id: string;
      type: "text";
      content: Array<ComposedInlineContent | ComposedRenderedInlineContent>;
    }
  | {
      id: string;
      type: "rich_text";
      content: ComposedRichContent;
    }
  | {
      id: string;
      type: "separator";
    }
  | {
      id: string;
      type: "response";
      responseFieldId: string;
      label?: string;
      placeholder?: string;
    }
  | {
      id: string;
      type: "table";
      table: TableBlockPreviewModel;
    }
  | {
      id: string;
      type: "container";
      containerType: "page" | "step";
      title?: string;
      blocks: PresentableQuestionBlock[];
    };

export type PresentableQuestion = {
  blocks: PresentableQuestionBlock[];
  responseFields: TableResponseField[];
};

export type QuestionPlayerProps = {
  question: PresentableQuestion;
  answer: QuestionAnswer;
  mode: QuestionPlayerMode;
  feedback?: QuestionGrade | null;
  referencePreviewCache?: ReferencePreviewCache;
  onAnswerChange(answer: QuestionAnswer): void;
};
