import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  createStudioSourceFingerprints,
  type StudioSource,
} from "./source/studio-source-model";
import type { StudioRouteSearch } from "./studio-route-intent";
import { toStudioSearch } from "./studio-route-intent";

export { toStudioSearch } from "./studio-route-intent";

export function createDraftSnapshotKey({
  blueprintId,
  blueprintName,
  description,
  sources,
  authoringModel,
}: {
  blueprintId: string;
  blueprintName: string;
  description: string;
  sources: StudioSource[];
  authoringModel: ComposedEditorModel;
}) {
  return JSON.stringify({
    authoringModel,
    blueprintId,
    blueprintName,
    description,
    sources: createStudioSourceFingerprints(sources),
  });
}

type StudioNavigator = (input: {
  to: "/studio";
  search: StudioRouteSearch;
  replace?: boolean;
}) => unknown;

export function navigateToStudioDraft(
  navigate: StudioNavigator,
  draftId: string,
  options?: { replace?: boolean },
) {
  return navigate({
    replace: options?.replace,
    search: toStudioSearch({ draftId, kind: "draft" }),
    to: "/studio",
  });
}

export function navigateToStudioBlueprint(
  navigate: StudioNavigator,
  blueprintId: string,
  options?: { replace?: boolean },
) {
  return navigate({
    replace: options?.replace,
    search: toStudioSearch({ blueprintId, kind: "blueprint" }),
    to: "/studio",
  });
}

export function navigateToNewStudioDraft(
  navigate: StudioNavigator,
  options?: { replace?: boolean },
) {
  return navigate({
    replace: options?.replace,
    search: toStudioSearch({ kind: "new" }),
    to: "/studio",
  });
}

export function navigateToBlankStudio(
  navigate: StudioNavigator,
  options?: { replace?: boolean },
) {
  return navigate({
    replace: options?.replace,
    search: toStudioSearch({ kind: "blank" }),
    to: "/studio",
  });
}
