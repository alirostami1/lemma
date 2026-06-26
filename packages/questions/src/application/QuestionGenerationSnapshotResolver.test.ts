import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  QuestionBlueprintSource,
  WorkbookCalculationId,
  WorkbookId,
  WorkbookSnapshotId,
} from "../domain/index.js";
import { WorkbookQuestionReferenceError } from "./errors.js";
import type { WorkbookSnapshotForQuestionGeneration } from "./ports.js";
import { resolveQuestionGenerationSnapshots } from "./QuestionGenerationSnapshotResolver.js";

const calculationId =
  "019e9315-6a87-715f-9861-8654df071001" as WorkbookCalculationId;
const otherCalculationId =
  "019e9315-6a87-715f-9861-8654df071002" as WorkbookCalculationId;
const workbookId = "019e9315-6a87-715f-9861-8654df071003" as WorkbookId;
const otherWorkbookId = "019e9315-6a87-715f-9861-8654df071004" as WorkbookId;

describe("resolveQuestionGenerationSnapshots", () => {
  it("maps valid snapshots by source id and question index", () => {
    const resolved = resolveQuestionGenerationSnapshots({
      eventWorkbookSnapshotIds: snapshots().map((snapshot) => snapshot.id),
      requestedCount: 2,
      snapshots: snapshots(),
      usedSources: sources(),
      workbookCalculationId: calculationId,
    });

    assert.equal(
      resolved.snapshotsBySourceIdAndQuestionIndex.get("source_1:1")?.id,
      snapshotId(2),
    );
    assert.deepEqual(
      resolved.snapshotsByQuestionIndex.get(0)?.map((snapshot) => snapshot.id),
      [snapshotId(0), snapshotId(1)],
    );
  });

  it("returns empty maps with no workbook sources", () => {
    const resolved = resolveQuestionGenerationSnapshots({
      requestedCount: 2,
      snapshots: [],
      usedSources: [],
      workbookCalculationId: calculationId,
    });

    assert.equal(resolved.snapshotsBySourceIdAndQuestionIndex.size, 0);
    assert.equal(resolved.snapshotsByQuestionIndex.size, 0);
  });

  it("rejects missing source/question coverage", () => {
    assert.throws(
      () =>
        resolveQuestionGenerationSnapshots({
          requestedCount: 2,
          snapshots: snapshots().slice(0, 3),
          usedSources: sources(),
          workbookCalculationId: calculationId,
        }),
      WorkbookQuestionReferenceError,
    );
  });

  it("rejects duplicate source/question snapshots", () => {
    const allSnapshots = snapshots();
    const [firstSnapshot] = allSnapshots;
    assert.ok(firstSnapshot);

    assert.throws(
      () =>
        resolveQuestionGenerationSnapshots({
          requestedCount: 2,
          snapshots: [...allSnapshots, { ...firstSnapshot, id: snapshotId(9) }],
          usedSources: sources(),
          workbookCalculationId: calculationId,
        }),
      /duplicate snapshot/,
    );
  });

  it("rejects wrong calculation, workbook, source, range, and event ids", () => {
    assert.throws(
      () =>
        resolveQuestionGenerationSnapshots({
          requestedCount: 2,
          snapshots: snapshots({ calculationId: otherCalculationId }),
          usedSources: sources(),
          workbookCalculationId: calculationId,
        }),
      /different workbook calculation/,
    );
    assert.throws(
      () =>
        resolveQuestionGenerationSnapshots({
          requestedCount: 2,
          snapshots: snapshots({ workbookId: otherWorkbookId }),
          usedSources: sources(),
          workbookCalculationId: calculationId,
        }),
      /expects workbook/,
    );
    assert.throws(
      () =>
        resolveQuestionGenerationSnapshots({
          requestedCount: 2,
          snapshots: snapshots({ sourceId: "source_3" }),
          usedSources: sources(),
          workbookCalculationId: calculationId,
        }),
      /unknown source/,
    );
    assert.throws(
      () =>
        resolveQuestionGenerationSnapshots({
          requestedCount: 2,
          snapshots: snapshots({ questionIndex: 2 }),
          usedSources: sources(),
          workbookCalculationId: calculationId,
        }),
      /outside requested range/,
    );
    assert.throws(
      () =>
        resolveQuestionGenerationSnapshots({
          eventWorkbookSnapshotIds: [snapshotId(0)],
          requestedCount: 2,
          snapshots: snapshots(),
          usedSources: sources(),
          workbookCalculationId: calculationId,
        }),
      /event snapshot ids do not match/,
    );
  });
});

function sources(): QuestionBlueprintSource[] {
  return [
    testSource("Source 1", "source_1"),
    testSource("Source 2", "source_2"),
  ];
}

function testSource(name: string, sourceId: string): QuestionBlueprintSource {
  return {
    byteSize: null,
    checksumSha256: null,
    fileId: null,
    name,
    originalName: null,
    sourceId,
    type: "workbook",
    workbookId,
  };
}

function snapshots(
  override: Partial<WorkbookSnapshotForQuestionGeneration> = {},
): WorkbookSnapshotForQuestionGeneration[] {
  return [0, 1].flatMap((questionIndex) =>
    sources().map((source, sourceIndex) => ({
      calculationId,
      id: snapshotId(questionIndex * 2 + sourceIndex),
      questionIndex,
      snapshotIndex: questionIndex * 2 + sourceIndex,
      sourceId: source.sourceId,
      workbookId: source.workbookId,
      ...override,
    })),
  );
}

function snapshotId(index: number): WorkbookSnapshotId {
  const suffix = String(1100 + index).padStart(4, "0");
  return `019e9315-6a87-715f-9861-8654df07${suffix}` as WorkbookSnapshotId;
}
