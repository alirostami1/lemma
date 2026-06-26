import { useEffect, useState } from "react";
import {
  useCreateQuestionBlueprintDraft,
  useCreateQuestionBlueprintEditDraft,
} from "#/domains/questions";
import {
  createDefaultComposedEditorModel,
  stripUnusedComposedReferences,
} from "#/domains/questions/authoring";
import { composedEditorModelToQuestionBlueprintDocument } from "#/domains/questions/canonical-authoring";
import type {
  CreateQuestionBlueprintDraftInput,
  CreateQuestionBlueprintEditDraftInput,
} from "#/domains/questions/model";
import { navigateToStudioDraft } from "./studio-controller-helpers";
import {
  isStudioRouteNormalized,
  type StudioRouteIntent,
  type StudioRouteSearch,
} from "./studio-route-intent";

export type StudioEntryRouteState = {
  errorMessage: string | null;
  isEntering: boolean;
};

type StudioNavigator = (input: {
  to: "/studio";
  search: StudioRouteSearch;
  replace?: boolean;
}) => unknown;

type EntryDraftCreateInput = {
  intent: Exclude<StudioRouteIntent, { type: "landing" | "edit_draft" }>;
  createDraft(input: CreateQuestionBlueprintDraftInput): Promise<{
    draft: { id: string };
  }>;
  createEditDraft(input: CreateQuestionBlueprintEditDraftInput): Promise<{
    draft: { id: string };
  }>;
};

// React Strict Mode remounts effects during development. Keep only in-flight
// entry promises here, then clear them in `finally`; no completed draft id is
// cached across route entries. Blueprint entries are also backend idempotent via
// resume_or_create.
const pendingEntryDraftIdsByKey = new Map<string, Promise<string>>();

export function useStudioEntryRoute({
  intent,
  navigate,
  routeSearch,
}: {
  intent: StudioRouteIntent;
  navigate: StudioNavigator;
  routeSearch: StudioRouteSearch;
}): StudioEntryRouteState {
  const createDraft = useCreateQuestionBlueprintDraft();
  const createEditDraft = useCreateQuestionBlueprintEditDraft();
  const [pendingIntentKey, setPendingIntentKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (intent.type === "landing") {
      setPendingIntentKey(null);
      setErrorMessage(null);
      return;
    }

    if (intent.type === "edit_draft") {
      setPendingIntentKey(null);
      setErrorMessage(null);
      if (!isStudioRouteNormalized(routeSearch)) {
        void navigateToStudioDraft(navigate, intent.draftId, {
          replace: true,
        });
      }
      return;
    }

    const intentKey = getEntryIntentKey(intent);
    let cancelled = false;
    setPendingIntentKey(intentKey);
    setErrorMessage(null);

    void getOrCreateEntryDraftId({
      createDraft: (input) => createDraft.mutateAsync(input),
      createEditDraft: (input) => createEditDraft.mutateAsync(input),
      intent,
    })
      .then((draftId) => {
        if (cancelled) {
          return;
        }

        void navigateToStudioDraft(navigate, draftId, { replace: true });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setPendingIntentKey(null);
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : "Studio draft could not be opened.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [createDraft, createEditDraft, intent, navigate, routeSearch]);

  return {
    errorMessage,
    isEntering: pendingIntentKey !== null,
  };
}

function getOrCreateEntryDraftId(
  input: EntryDraftCreateInput,
): Promise<string> {
  const intentKey = getEntryIntentKey(input.intent);
  const pendingDraftId = pendingEntryDraftIdsByKey.get(intentKey);
  if (pendingDraftId) {
    return pendingDraftId;
  }

  const draftIdPromise = createEntryDraftId(input).finally(() => {
    pendingEntryDraftIdsByKey.delete(intentKey);
  });
  pendingEntryDraftIdsByKey.set(intentKey, draftIdPromise);
  return draftIdPromise;
}

async function createEntryDraftId({
  intent,
  createDraft,
  createEditDraft,
}: EntryDraftCreateInput): Promise<string> {
  if (intent.type === "edit_blueprint") {
    const result = await createEditDraft({
      questionBlueprintId: intent.blueprintId,
    });
    return result.draft.id;
  }

  const result = await createDraft(createBlankDraftInput());
  return result.draft.id;
}

function createBlankDraftInput(): CreateQuestionBlueprintDraftInput {
  const model = stripUnusedComposedReferences(
    createDefaultComposedEditorModel(),
  );

  return {
    blueprintId: null,
    description: null,
    document: composedEditorModelToQuestionBlueprintDocument(model),
    name: "Question blueprint",
    sources: [],
  };
}

function getEntryIntentKey(
  intent: Exclude<StudioRouteIntent, { type: "landing" | "edit_draft" }>,
): string {
  switch (intent.type) {
    case "edit_blueprint":
      return `blueprint:${intent.blueprintId}`;
    case "new_draft":
      return "new";
  }
}
