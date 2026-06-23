import type {
  ComposedEditorBlock,
  ComposedEditorModel,
} from "#/domains/questions/authoring";
import {
  extractInlineReferenceIds,
  extractReferenceIdsFromValueExpression,
  extractRichReferenceIds,
  extractUsedReferenceIdsFromComposedEditorModel,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintDocument } from "#/domains/questions/model";
import {
  getWorkbookReferenceDisplayName,
  getWorkbookReferenceKeyForSource,
} from "#/domains/questions/reference-names";
import type { StudioSource } from "./studio-source-model";

const USED_SOURCE_REMOVE_REASON =
  "This source is used by the blueprint. Remove its references before detaching it.";

export type StudioSourceRemovalState =
  | { removable: true }
  | { removable: false; reason: string };

export type StudioSourceUsageLocation = {
  kind: "block" | "response_field" | "unknown";
  label: string;
  referenceId: string;
  referenceName: string;
  sourceRef: string;
  referenceKind: "cell" | "range" | "unknown";
};

export type StudioSourceUsageSummary = {
  sourceId: string;
  isUsed: boolean;
  referenceCount: number;
  usedWhere: readonly StudioSourceUsageLocation[];
  removal: StudioSourceRemovalState;
};

export function getUsedSourceIdsFromBlueprintDocument(
  document: QuestionBlueprintDocument,
): ReadonlySet<string> {
  const used = new Set<string>();

  for (const reference of document.references) {
    switch (reference.source.type) {
      case "workbook_cell":
      case "workbook_range":
        used.add(reference.source.sourceId);
        break;
      default:
        break;
    }
  }

  return used;
}

export function getUsedSourceIdsFromComposedEditorModel(
  model: ComposedEditorModel,
): ReadonlySet<string> {
  return new Set(buildSourceUsageBySourceId({ model, sources: [] }).keys());
}

export function buildSourceUsageBySourceId(input: {
  model: ComposedEditorModel;
  sources: readonly StudioSource[];
}): ReadonlyMap<string, StudioSourceUsageSummary> {
  const usedReferenceIds = new Set(
    extractUsedReferenceIdsFromComposedEditorModel(input.model),
  );
  const locationsByReferenceId = buildReferenceUsageLocations(input.model);
  const summaries = new Map<string, StudioSourceUsageSummary>();

  for (const source of input.sources) {
    summaries.set(source.sourceId, {
      isUsed: false,
      referenceCount: 0,
      removal: { removable: true },
      sourceId: source.sourceId,
      usedWhere: [],
    });
  }

  for (const reference of input.model.references) {
    if (!usedReferenceIds.has(reference.id)) {
      continue;
    }

    if (
      reference.source.type !== "workbook_cell" &&
      reference.source.type !== "workbook_range"
    ) {
      continue;
    }
    const workbookSource = reference.source;
    const sourceRef = getWorkbookReferenceDisplayName(workbookSource);
    const referenceKind =
      workbookSource.type === "workbook_range" ? "range" : "cell";

    const current = summaries.get(reference.source.sourceId) ?? {
      isUsed: false,
      referenceCount: 0,
      removal: { removable: true } as const,
      sourceId: reference.source.sourceId,
      usedWhere: [],
    };
    const location = locationsByReferenceId.get(reference.id) ?? {
      kind: "unknown" as const,
      label: "Blueprint content",
      referenceId: reference.id,
      referenceKind: "unknown",
      referenceName:
        getWorkbookReferenceKeyForSource(workbookSource) ?? reference.id,
      sourceRef: "",
    };
    const nextUsedWhere = dedupeUsageLocation([...current.usedWhere, location]);
    const nextReferenceCount = new Set(
      nextUsedWhere.map((entry) => entry.referenceId),
    ).size;
    const nextSummary: StudioSourceUsageSummary = {
      isUsed: true,
      referenceCount: nextReferenceCount,
      removal: {
        reason: USED_SOURCE_REMOVE_REASON,
        removable: false,
      },
      sourceId: current.sourceId,
      usedWhere: nextUsedWhere.map((entry) =>
        entry.referenceId === reference.id
          ? {
              ...entry,
              referenceKind,
              referenceName:
                getWorkbookReferenceKeyForSource(workbookSource) ??
                reference.id,
              sourceRef,
            }
          : entry,
      ),
    };

    summaries.set(reference.source.sourceId, nextSummary);
  }

  return summaries;
}

export function getSourceRemovalState(input: {
  sourceId: string;
  usageBySourceId: ReadonlyMap<string, StudioSourceUsageSummary>;
}): StudioSourceRemovalState {
  return (
    input.usageBySourceId.get(input.sourceId)?.removal ?? { removable: true }
  );
}

export function createNextSourceId(input: {
  existingSources: readonly StudioSource[];
  preferredName: string;
  type: StudioSource["type"];
}): string {
  const existingIds = new Set(
    input.existingSources.map((source) => source.sourceId),
  );
  const base = sanitizeSourceIdBase(input.preferredName, input.type);

  if (!existingIds.has(base)) {
    return base;
  }

  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

export function getUsedSourceRemoveReason(): string {
  return USED_SOURCE_REMOVE_REASON;
}

function sanitizeSourceIdBase(
  preferredName: string,
  fallbackType: StudioSource["type"],
): string {
  const normalized = preferredName
    .trim()
    .toLowerCase()
    .replace(/\.xlsx$/iu, "")
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-+/u, "")
    .replace(/-+$/u, "");
  const candidate = normalized.length > 0 ? normalized : fallbackType;

  if (/^[a-z]/u.test(candidate)) {
    return candidate;
  }

  return `s-${candidate}`;
}

function buildReferenceUsageLocations(
  model: ComposedEditorModel,
): Map<string, StudioSourceUsageLocation> {
  const locations = new Map<string, StudioSourceUsageLocation>();
  let textBlockCount = 0;
  let richTextBlockCount = 0;
  let responseBlockCount = 0;

  for (const block of model.blocks) {
    switch (block.type) {
      case "text": {
        textBlockCount += 1;
        addLocations(
          locations,
          extractInlineReferenceIds(block.content),
          createBlockLabel(block, textBlockCount),
        );
        break;
      }
      case "rich_text": {
        richTextBlockCount += 1;
        addLocations(
          locations,
          extractRichReferenceIds(block.content),
          createBlockLabel(block, richTextBlockCount),
        );
        break;
      }
      case "response": {
        responseBlockCount += 1;
        addLocations(
          locations,
          extractReferenceIdsFromValueExpression(block.correctValueSource),
          createBlockLabel(block, responseBlockCount),
          "response_field",
        );
        break;
      }
      case "table": {
        addTableLocations(locations, block);
        break;
      }
      default:
        break;
    }
  }

  return locations;
}

function addLocations(
  locations: Map<string, StudioSourceUsageLocation>,
  referenceIds: readonly string[],
  label: string,
  kind: StudioSourceUsageLocation["kind"] = "block",
) {
  for (const referenceId of referenceIds) {
    if (!locations.has(referenceId)) {
      locations.set(referenceId, {
        kind,
        label,
        referenceId,
        referenceKind: "unknown",
        referenceName: referenceId,
        sourceRef: "",
      });
    }
  }
}

function addTableLocations(
  locations: Map<string, StudioSourceUsageLocation>,
  block: Extract<ComposedEditorBlock, { type: "table" }>,
) {
  for (const cell of block.table.cells) {
    if (cell.type === "content") {
      for (const referenceId of extractInlineReferenceIds(cell.content)) {
        if (!locations.has(referenceId)) {
          locations.set(referenceId, {
            kind: "block",
            label: "Table cell",
            referenceId,
            referenceKind: "unknown",
            referenceName: referenceId,
            sourceRef: "",
          });
        }
      }
      continue;
    }

    for (const referenceId of extractReferenceIdsFromValueExpression(
      cell.correctValueSource,
    )) {
      if (!locations.has(referenceId)) {
        locations.set(referenceId, {
          kind: "response_field",
          label: "Answer field",
          referenceId,
          referenceKind: "unknown",
          referenceName: referenceId,
          sourceRef: "",
        });
      }
    }
  }
}

function createBlockLabel(block: ComposedEditorBlock, count: number): string {
  switch (block.type) {
    case "text":
      return `Text block ${count}`;
    case "rich_text":
      return `Question block ${count}`;
    case "response":
      return `Answer block ${count}`;
    default:
      return `Block ${count}`;
  }
}

function dedupeUsageLocation(
  locations: readonly StudioSourceUsageLocation[],
): readonly StudioSourceUsageLocation[] {
  const seen = new Set<string>();
  const deduped: StudioSourceUsageLocation[] = [];

  for (const location of locations) {
    const key = `${location.referenceId}:${location.label}:${location.sourceRef}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(location);
  }

  return deduped;
}
