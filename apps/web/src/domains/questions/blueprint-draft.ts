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
  sources: QuestionBlueprintDraft["sources"];
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
      code: "missing_name",
      ok: false,
    };
  }

  try {
    return {
      ok: true,
      value: {
        description:
          input.description.trim().length > 0 ? input.description.trim() : null,
        document: composedEditorModelToQuestionBlueprintDocument(
          stripUnusedComposedReferences(input.model),
        ),
        name,
        sources: input.sources,
      },
    };
  } catch (error) {
    return {
      cause: error,
      code: "invalid_document",
      ok: false,
    };
  }
}
