import type {
  ComposedEditorBlock,
  ComposedEditorModel,
  ReferenceUsage,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintDocument } from "#/domains/questions/model";
import { getWorkbookReferenceUsagesBySource } from "#/domains/questions/reference-integrity";
import {
  getWorkbookReferenceDisplayName,
  getWorkbookReferenceKeyForSource,
} from "#/domains/questions/reference-names";
import type { StudioSource } from "./studio-source-model";

const USED_SOURCE_REMOVE_REASON =
  "This workbook is used by inserted values. Remove those values before detaching it.";

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
  const summaries = new Map<string, StudioSourceUsageSummary>();
  const usagesBySourceId = getWorkbookReferenceUsagesBySource(input.model);

  for (const source of input.sources) {
    summaries.set(source.sourceId, {
      isUsed: false,
      referenceCount: 0,
      removal: { removable: true },
      sourceId: source.sourceId,
      usedWhere: [],
    });
  }

  for (const [sourceId, usages] of usagesBySourceId) {
    let current = summaries.get(sourceId) ?? {
      isUsed: false,
      referenceCount: 0,
      removal: { removable: true } as const,
      sourceId,
      usedWhere: [],
    };

    for (const usage of usages) {
      const workbookSource = usage.reference.source;
      if (
        workbookSource.type !== "workbook_cell" &&
        workbookSource.type !== "workbook_range"
      ) {
        continue;
      }

      const sourceRef = getWorkbookReferenceDisplayName(workbookSource);
      const referenceKind: StudioSourceUsageLocation["referenceKind"] =
        workbookSource.type === "workbook_range" ? "range" : "cell";
      const usageLocations = usage.locations.map((location) => ({
        ...createStudioSourceUsageLocation(input.model, location),
        referenceId: usage.reference.id,
        referenceKind,
        referenceName:
          getWorkbookReferenceKeyForSource(workbookSource) ??
          usage.reference.id,
        sourceRef,
      }));
      const nextUsedWhere = dedupeUsageLocation([
        ...current.usedWhere,
        ...usageLocations,
      ]);
      current = {
        isUsed: true,
        referenceCount: new Set(nextUsedWhere.map((entry) => entry.referenceId))
          .size,
        removal: {
          reason: USED_SOURCE_REMOVE_REASON,
          removable: false,
        },
        sourceId: current.sourceId,
        usedWhere: nextUsedWhere,
      };
    }

    summaries.set(sourceId, current);
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

function createStudioSourceUsageLocation(
  model: ComposedEditorModel,
  usage: ReferenceUsage,
): Omit<
  StudioSourceUsageLocation,
  "referenceId" | "referenceKind" | "referenceName" | "sourceRef"
> {
  const block = model.blocks.find(
    (candidate) => candidate.id === usage.blockId,
  );
  const blockTypeCount = block
    ? model.blocks
        .slice(
          0,
          model.blocks.findIndex((candidate) => candidate.id === block.id) + 1,
        )
        .filter((candidate) => candidate.type === block.type).length
    : 1;

  switch (usage.type) {
    case "text_block":
    case "rich_text_block":
      return {
        kind: "block",
        label: block
          ? createBlockLabel(block, blockTypeCount)
          : "Question content",
      };
    case "response_answer":
      return {
        kind: "response_field",
        label: block ? createBlockLabel(block, blockTypeCount) : "Answer",
      };
    case "table_content_cell":
      return { kind: "block", label: "Table content cell" };
    case "table_answer_cell":
      return { kind: "response_field", label: "Table answer cell" };
  }
}

function dedupeUsageLocation(
  locations: readonly StudioSourceUsageLocation[],
): readonly StudioSourceUsageLocation[] {
  const seen = new Set<string>();
  const deduped: StudioSourceUsageLocation[] = [];

  for (const location of locations) {
    // Source removal only needs a human-readable area summary; occurrence-exact
    // remediation is built from ReferenceUsage in the recovery view model.
    const key = `${location.referenceId}:${location.label}:${location.sourceRef}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(location);
  }

  return deduped;
}
