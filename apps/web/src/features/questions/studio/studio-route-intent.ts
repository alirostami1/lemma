export type StudioRouteSearch = {
  blueprintId?: string;
  draftId?: string;
  new?: string;
};

export type StudioRouteIntent =
  | { type: "landing" }
  | { type: "new_draft" }
  | { type: "edit_blueprint"; blueprintId: string }
  | { type: "edit_draft"; draftId: string };

export type StudioRouteTarget =
  | { kind: "blank" }
  | { kind: "blueprint"; blueprintId: string }
  | { kind: "draft"; draftId: string }
  | { kind: "new" };

export function parseStudioRouteSearch(
  search: Record<string, unknown>,
): StudioRouteSearch {
  return {
    blueprintId: toRouteParam(search.blueprintId),
    draftId: toRouteParam(search.draftId),
    new: toRouteParam(search.new),
  };
}

export function parseStudioRouteIntent(
  search: StudioRouteSearch,
): StudioRouteIntent {
  const draftId = toRouteParam(search.draftId);
  if (draftId) {
    return { draftId, type: "edit_draft" };
  }

  if (search.new === "1") {
    return { type: "new_draft" };
  }

  const blueprintId = toRouteParam(search.blueprintId);
  if (blueprintId) {
    return { blueprintId, type: "edit_blueprint" };
  }

  return { type: "landing" };
}

export function normalizeStudioRoute(
  search: StudioRouteSearch,
): StudioRouteSearch {
  const intent = parseStudioRouteIntent(search);
  switch (intent.type) {
    case "edit_draft":
      return { draftId: intent.draftId };
    case "new_draft":
      return { new: "1" };
    case "edit_blueprint":
      return { blueprintId: intent.blueprintId };
    case "landing":
      return {};
  }
}

export function isStudioRouteNormalized(search: StudioRouteSearch): boolean {
  return studioRouteSearchEquals(search, normalizeStudioRoute(search));
}

export function toStudioSearch(target: StudioRouteTarget): StudioRouteSearch {
  switch (target.kind) {
    case "blank":
      return {};
    case "blueprint":
      return { blueprintId: target.blueprintId };
    case "draft":
      return { draftId: target.draftId };
    case "new":
      return { new: "1" };
  }
}

function studioRouteSearchEquals(
  left: StudioRouteSearch,
  right: StudioRouteSearch,
): boolean {
  return (
    (left.blueprintId ?? undefined) === (right.blueprintId ?? undefined) &&
    (left.draftId ?? undefined) === (right.draftId ?? undefined) &&
    (left.new ?? undefined) === (right.new ?? undefined)
  );
}

function toRouteParam(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
