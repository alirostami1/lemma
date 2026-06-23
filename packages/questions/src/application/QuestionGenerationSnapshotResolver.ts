import type {
  QuestionBlueprintSource,
  WorkbookCalculationId,
  WorkbookSnapshotId,
} from "../domain/index.js";
import { WorkbookQuestionReferenceError } from "./errors.js";
import {
  type QuestionGenerationSnapshotKey,
  questionGenerationSnapshotKey,
  type WorkbookSnapshotForQuestionGeneration,
} from "./ports.js";

export type ResolvedQuestionGenerationSnapshots = {
  snapshotsBySourceIdAndQuestionIndex: ReadonlyMap<
    QuestionGenerationSnapshotKey,
    WorkbookSnapshotForQuestionGeneration
  >;
  snapshotsByQuestionIndex: ReadonlyMap<
    number,
    readonly WorkbookSnapshotForQuestionGeneration[]
  >;
};

export function resolveQuestionGenerationSnapshots(input: {
  workbookCalculationId: WorkbookCalculationId;
  requestedCount: number;
  usedSources: readonly QuestionBlueprintSource[];
  snapshots: readonly WorkbookSnapshotForQuestionGeneration[];
  eventWorkbookSnapshotIds?: readonly WorkbookSnapshotId[];
}): ResolvedQuestionGenerationSnapshots {
  if (input.usedSources.length === 0) {
    return {
      snapshotsByQuestionIndex: new Map(),
      snapshotsBySourceIdAndQuestionIndex: new Map(),
    };
  }

  const sourceById = new Map(
    input.usedSources.map((source) => [source.sourceId, source]),
  );
  const snapshotsByKey = new Map<
    QuestionGenerationSnapshotKey,
    WorkbookSnapshotForQuestionGeneration
  >();
  const snapshotsByQuestionIndex = new Map<
    number,
    WorkbookSnapshotForQuestionGeneration[]
  >();

  for (const snapshot of input.snapshots) {
    if (snapshot.calculationId !== input.workbookCalculationId) {
      throw new WorkbookQuestionReferenceError(
        "Workbook snapshot belongs to a different workbook calculation.",
      );
    }
    const source = sourceById.get(snapshot.sourceId);
    if (!source) {
      throw new WorkbookQuestionReferenceError(
        `Workbook calculation produced snapshot for unknown source ${snapshot.sourceId}.`,
      );
    }
    if (snapshot.workbookId !== source.workbookId) {
      throw new WorkbookQuestionReferenceError(
        `Workbook snapshot source ${snapshot.sourceId} belongs to workbook ${snapshot.workbookId} but blueprint snapshot expects workbook ${source.workbookId}.`,
      );
    }
    if (
      !Number.isInteger(snapshot.questionIndex) ||
      snapshot.questionIndex < 0 ||
      snapshot.questionIndex >= input.requestedCount
    ) {
      throw new WorkbookQuestionReferenceError(
        `Workbook snapshot source ${snapshot.sourceId} has question index outside requested range.`,
      );
    }
    if (
      !Number.isInteger(snapshot.snapshotIndex) ||
      snapshot.snapshotIndex < 0
    ) {
      throw new WorkbookQuestionReferenceError(
        `Workbook snapshot source ${snapshot.sourceId} has invalid snapshot index.`,
      );
    }

    const key = questionGenerationSnapshotKey({
      questionIndex: snapshot.questionIndex,
      sourceId: snapshot.sourceId,
    });
    if (snapshotsByKey.has(key)) {
      throw new WorkbookQuestionReferenceError(
        `Workbook calculation produced duplicate snapshot for source ${snapshot.sourceId} at question index ${snapshot.questionIndex}.`,
      );
    }
    snapshotsByKey.set(key, snapshot);
    const questionSnapshots =
      snapshotsByQuestionIndex.get(snapshot.questionIndex) ?? [];
    questionSnapshots.push(snapshot);
    snapshotsByQuestionIndex.set(snapshot.questionIndex, questionSnapshots);
  }

  const requiredCount = input.requestedCount * input.usedSources.length;
  if (snapshotsByKey.size !== requiredCount) {
    throw new WorkbookQuestionReferenceError(
      "Workbook calculation snapshot coverage does not match requested questions and sources.",
    );
  }

  for (
    let questionIndex = 0;
    questionIndex < input.requestedCount;
    questionIndex += 1
  ) {
    for (const source of input.usedSources) {
      const key = questionGenerationSnapshotKey({
        questionIndex,
        sourceId: source.sourceId,
      });
      if (!snapshotsByKey.has(key)) {
        throw new WorkbookQuestionReferenceError(
          `Workbook calculation is missing snapshot for source ${source.sourceId} at question index ${questionIndex}.`,
        );
      }
    }
  }

  if (input.eventWorkbookSnapshotIds) {
    assertSnapshotIdSetsMatch({
      eventIds: input.eventWorkbookSnapshotIds,
      loadedIds: [...snapshotsByKey.values()].map((snapshot) => snapshot.id),
    });
  }

  return {
    snapshotsByQuestionIndex,
    snapshotsBySourceIdAndQuestionIndex: snapshotsByKey,
  };
}

function assertSnapshotIdSetsMatch(input: {
  loadedIds: readonly WorkbookSnapshotId[];
  eventIds: readonly WorkbookSnapshotId[];
}) {
  const loaded = new Set(input.loadedIds);
  const event = new Set(input.eventIds);
  if (loaded.size !== event.size) {
    throw new WorkbookQuestionReferenceError(
      "Workbook calculation event snapshot ids do not match persisted snapshots.",
    );
  }
  for (const id of loaded) {
    if (!event.has(id)) {
      throw new WorkbookQuestionReferenceError(
        "Workbook calculation event snapshot ids do not match persisted snapshots.",
      );
    }
  }
}
