import {
  type ComposedEditorModel,
  stripUnusedComposedReferences,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintDraft } from "./blueprint";
import { composedEditorModelToQuestionBlueprintDocument } from "./canonical-authoring";

export type BuildQuestionBlueprintDraftInput = {
  name: string;
  description: string;
  model: ComposedEditorModel;
  workbookId: string | null;
  workbookSources?: QuestionBlueprintDraft["workbookSources"];
};

export type BuildQuestionBlueprintDraftResult =
  | {
      ok: true;
      value: QuestionBlueprintDraft;
    }
  | {
      ok: false;
      code: "missing_name" | "invalid_document";
      cause?: unknown;
    };

export function buildQuestionBlueprintDraft(
  input: BuildQuestionBlueprintDraftInput,
): BuildQuestionBlueprintDraftResult {
  const name = input.name.trim();
  if (name.length === 0) {
    return {
      ok: false,
      code: "missing_name",
    };
  }

  try {
    return {
      ok: true,
      value: {
        name,
        description:
          input.description.trim().length > 0 ? input.description.trim() : null,
        document: composedEditorModelToQuestionBlueprintDocument(
          stripUnusedComposedReferences(input.model),
        ),
        workbookId: input.workbookId,
        workbookSources: input.workbookSources,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: "invalid_document",
      cause: error,
    };
  }
}
