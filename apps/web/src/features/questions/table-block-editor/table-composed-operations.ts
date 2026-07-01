import type {
  ComposedEditorModel,
  ComposedReferenceDraft,
  ReferenceSourceDraft,
  TableEditorCell,
  TableSelectedCellAnswerResolution,
} from "#/domains/questions/authoring";
import {
  findComposedBlockById,
  getFirstRangeBackedReferenceInTableCell,
  getWorkbookCellRefAtOffset,
  makeSelectedCellsResponseWithCellResolution,
  updateComposedBlock,
} from "#/domains/questions/authoring";
import { getReferenceIdForSource } from "#/domains/questions/reference-names";
import type { TableEditorSelection } from "./table-selection";

export type SelectedTableCellsResponseConversionResult = {
  model: ComposedEditorModel;
  convertedCellCount: number;
  blockedRangeBackedCellCount: number;
};

type TableComposedAnswerConversionState = {
  directWorkbookCellReferencesBySource: Map<string, ComposedReferenceDraft>;
  nextReferenceIndex: number;
  references: ComposedReferenceDraft[];
  referencesById: ReadonlyMap<string, ComposedReferenceDraft>;
  usedReferenceIds: Set<string>;
};

export function makeSelectedTableCellsResponseInComposedModel(input: {
  editorModel: ComposedEditorModel;
  tableBlockId: string;
  selection: TableEditorSelection;
}): ComposedEditorModel {
  return makeSelectedTableCellsResponseInComposedModelResult(input).model;
}

export function makeSelectedTableCellsResponseInComposedModelResult(input: {
  editorModel: ComposedEditorModel;
  tableBlockId: string;
  selection: TableEditorSelection;
}): SelectedTableCellsResponseConversionResult {
  const tableBlock = findComposedBlockById(
    input.editorModel.blocks,
    input.tableBlockId,
  );
  if (tableBlock?.type !== "table") {
    return {
      blockedRangeBackedCellCount: 0,
      convertedCellCount: 0,
      model: input.editorModel,
    };
  }

  const conversionState = createTableComposedAnswerConversionState(
    input.editorModel.references,
  );
  const tableResult = makeSelectedCellsResponseWithCellResolution(
    tableBlock.table,
    input.selection,
    (cell) => resolveTableComposedAnswerCell(cell, conversionState),
  );
  const referencesChanged =
    conversionState.references.length !== input.editorModel.references.length;
  const nextModel =
    tableResult.model === tableBlock.table && !referencesChanged
      ? input.editorModel
      : updateComposedBlock(
          {
            ...input.editorModel,
            references: referencesChanged
              ? conversionState.references
              : input.editorModel.references,
          },
          input.tableBlockId,
          (block) =>
            block.type === "table"
              ? { ...block, table: tableResult.model }
              : block,
        );

  return {
    blockedRangeBackedCellCount: tableResult.skippedCellCount,
    convertedCellCount: tableResult.convertedCellCount,
    model: nextModel,
  };
}

function createTableComposedAnswerConversionState(
  references: ComposedReferenceDraft[],
): TableComposedAnswerConversionState {
  const directWorkbookCellReferencesBySource = new Map<
    string,
    ComposedReferenceDraft
  >();
  for (const reference of references) {
    if (reference.source.type === "workbook_cell") {
      directWorkbookCellReferencesBySource.set(
        workbookCellReferenceSourceKey(reference.source),
        reference,
      );
    }
  }

  return {
    directWorkbookCellReferencesBySource,
    nextReferenceIndex: 1,
    references: [...references],
    referencesById: new Map(
      references.map((reference) => [reference.id, reference]),
    ),
    usedReferenceIds: new Set(references.map((reference) => reference.id)),
  };
}

function resolveTableComposedAnswerCell(
  cell: TableEditorCell,
  state: TableComposedAnswerConversionState,
): TableSelectedCellAnswerResolution {
  const rangeBackedReference = getFirstRangeBackedReferenceInTableCell(cell);
  if (!rangeBackedReference) {
    return { type: "convert" };
  }

  const rangeReference = state.referencesById.get(
    rangeBackedReference.referenceId,
  );
  if (rangeReference?.source.type !== "workbook_range") {
    return { type: "skip" };
  }

  const concreteRef = getWorkbookCellRefAtOffset({
    columnOffset: rangeBackedReference.rangeCell.columnOffset,
    rangeRef: rangeReference.source.ref,
    rowOffset: rangeBackedReference.rangeCell.rowOffset,
  });
  if (!concreteRef) {
    return { type: "skip" };
  }

  const source: ReferenceSourceDraft = {
    ref: concreteRef,
    sourceId: rangeReference.source.sourceId,
    type: "workbook_cell",
  };
  const directReference = getOrCreateDirectWorkbookCellReference(state, source);

  return {
    options: {
      correctValueSource: {
        referenceId: directReference.id,
        type: "reference",
      },
      dropSingleReferenceContent: true,
    },
    type: "convert",
  };
}

function getOrCreateDirectWorkbookCellReference(
  state: TableComposedAnswerConversionState,
  source: Extract<ReferenceSourceDraft, { type: "workbook_cell" }>,
): ComposedReferenceDraft {
  const sourceKey = workbookCellReferenceSourceKey(source);
  const existingReference =
    state.directWorkbookCellReferencesBySource.get(sourceKey);
  if (existingReference) {
    return existingReference;
  }

  const reference: ComposedReferenceDraft = {
    id: allocateDirectWorkbookCellReferenceId(state, source),
    source,
  };
  state.references.push(reference);
  state.directWorkbookCellReferencesBySource.set(sourceKey, reference);
  return reference;
}

function allocateDirectWorkbookCellReferenceId(
  state: TableComposedAnswerConversionState,
  source: Extract<ReferenceSourceDraft, { type: "workbook_cell" }>,
): string {
  const canonicalReferenceId = getReferenceIdForSource(source);
  if (
    canonicalReferenceId &&
    !state.usedReferenceIds.has(canonicalReferenceId)
  ) {
    state.usedReferenceIds.add(canonicalReferenceId);
    return canonicalReferenceId;
  }

  let referenceId = `reference_${state.nextReferenceIndex}`;
  while (state.usedReferenceIds.has(referenceId)) {
    state.nextReferenceIndex += 1;
    referenceId = `reference_${state.nextReferenceIndex}`;
  }
  state.nextReferenceIndex += 1;
  state.usedReferenceIds.add(referenceId);
  return referenceId;
}

function workbookCellReferenceSourceKey(
  source: Extract<ReferenceSourceDraft, { type: "workbook_cell" }>,
): string {
  return JSON.stringify([source.sourceId, source.ref]);
}
