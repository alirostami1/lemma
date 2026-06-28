import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import {
  createInitialWorkbookCalculation,
  createWorkbookSnapshot,
  InvalidWorkbookSnapshotReferenceError,
  userId,
  type Workbook,
  type WorkbookCalculation,
  type WorkbookSnapshot,
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
} from "../domain/index.js";
import { ForbiddenWorkbookActionError } from "./errors.js";
import type { WorkbookRepository } from "./ports.js";
import { WorkbookSnapshotService } from "./WorkbookSnapshotService.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df071001");
const otherUserId = userId("019e9315-6a87-715f-9861-8654df071002");
const targetWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df071003");
const targetCalculationId = workbookCalculationId(
  "019e9315-6a87-715f-9861-8654df071004",
);
const targetSnapshotId = workbookSnapshotId(
  "019e9315-6a87-715f-9861-8654df071005",
);

describe("WorkbookSnapshotService", () => {
  it("lists snapshots visible to the calculation owner", async () => {
    const harness = createHarness();

    const result = await harness.service.listWorkbookSnapshots({
      currentUser: currentUser(ownerUserId),
      limit: 10,
      workbookCalculationId: targetCalculationId,
    });

    assert.deepEqual(
      result.workbookSnapshots.map((snapshot) => snapshot.id),
      [targetSnapshotId],
    );
    assert.equal(result.nextCursor, null);
  });

  it("resolves snapshot values for internal callers without user auth", async () => {
    const harness = createHarness();

    const result =
      await harness.service.resolveWorkbookSnapshotValueForInternal({
        source: { ref: "Sheet1!A1", type: "cell" },
        workbookSnapshotId: targetSnapshotId,
      });

    assert.equal(result.value, "42");
  });

  it("lists snapshot sheets for the owner", async () => {
    const harness = createHarness();

    const result = await harness.service.listWorkbookSnapshotSheets({
      currentUser: currentUser(ownerUserId),
      limit: 1,
      workbookSnapshotId: targetSnapshotId,
    });

    assert.deepEqual(result, {
      nextCursor: null,
      workbookSnapshotSheets: [
        {
          columnCount: 2,
          name: "Sheet1",
          nonEmptyCellCount: 2,
          rowCount: 2,
          sheetIndex: 0,
        },
      ],
    });
  });

  it("returns snapshot metadata for the owner", async () => {
    const harness = createHarness();

    const result = await harness.service.getWorkbookSnapshotMetadata({
      currentUser: currentUser(ownerUserId),
      workbookSnapshotId: targetSnapshotId,
    });

    assert.deepEqual(result.workbookSnapshotMetadata, {
      cellCount: 2,
      sheetCount: 1,
      status: "ready",
    });
  });

  it("returns displayed sheet cells with type metadata", async () => {
    const harness = createHarness();

    const result = await harness.service.getWorkbookSnapshotCells({
      columnCount: 2,
      currentUser: currentUser(ownerUserId),
      rowCount: 2,
      sheetIndex: 0,
      startColumn: 1,
      startRow: 1,
      workbookSnapshotId: targetSnapshotId,
    });

    assert.deepEqual(result.workbookSnapshotCells, {
      cellTypes: [
        ["number", "blank"],
        ["blank", "number"],
      ],
      columnCount: 2,
      rowCount: 2,
      rows: [
        ["42", ""],
        ["", "84"],
      ],
      sheetIndex: 0,
      sheetName: "Sheet1",
      startColumn: 1,
      startRow: 1,
    });
  });

  it("returns selected ranges with normalized references", async () => {
    const harness = createHarness();

    const result = await harness.service.getWorkbookSnapshotRange({
      currentUser: currentUser(ownerUserId),
      ref: "Sheet1!A1:B2",
      workbookSnapshotId: targetSnapshotId,
    });

    assert.deepEqual(result.workbookSnapshotRange, {
      cellTypes: [
        ["number", "blank"],
        ["blank", "number"],
      ],
      columnCount: 2,
      endCellAddress: "B2",
      ref: "'Sheet1'!A1:B2",
      rowCount: 2,
      rows: [
        ["42", ""],
        ["", "84"],
      ],
      sheetIndex: 0,
      sheetName: "Sheet1",
      startCellAddress: "A1",
      startColumn: 1,
      startRow: 1,
    });
  });

  it("accepts quoted single-cell refs for selected ranges", async () => {
    const harness = createHarness();

    const result = await harness.service.getWorkbookSnapshotRange({
      currentUser: currentUser(ownerUserId),
      ref: "'Sheet1'!A1",
      workbookSnapshotId: targetSnapshotId,
    });

    assert.deepEqual(result.workbookSnapshotRange, {
      cellTypes: [["number"]],
      columnCount: 1,
      endCellAddress: "A1",
      ref: "'Sheet1'!A1:A1",
      rowCount: 1,
      rows: [["42"]],
      sheetIndex: 0,
      sheetName: "Sheet1",
      startCellAddress: "A1",
      startColumn: 1,
      startRow: 1,
    });
  });

  it("rejects sheet page limits outside the public bounds", async () => {
    const harness = createHarness();

    await assert.rejects(
      () =>
        harness.service.listWorkbookSnapshotSheets({
          currentUser: currentUser(ownerUserId),
          limit: 0,
          workbookSnapshotId: targetSnapshotId,
        }),
      InvalidWorkbookSnapshotReferenceError,
    );
  });

  it("rejects snapshot ranges outside public bounds", async () => {
    const harness = createHarness();

    await assert.rejects(
      () =>
        harness.service.getWorkbookSnapshotCells({
          columnCount: 51,
          currentUser: currentUser(ownerUserId),
          rowCount: 1,
          sheetIndex: 0,
          startColumn: 1,
          startRow: 1,
          workbookSnapshotId: targetSnapshotId,
        }),
      InvalidWorkbookSnapshotReferenceError,
    );
  });

  it("rejects cell windows above the total cell cap", async () => {
    const harness = createHarness();

    await assert.rejects(
      () =>
        harness.service.getWorkbookSnapshotCells({
          columnCount: 50,
          currentUser: currentUser(ownerUserId),
          rowCount: 100,
          sheetIndex: 0,
          startColumn: 1,
          startRow: 1,
          workbookSnapshotId: targetSnapshotId,
        }),
      InvalidWorkbookSnapshotReferenceError,
    );
  });

  it("rejects cell windows above the value byte cap", async () => {
    const harness = createHarness({
      cells: { A1: "x".repeat(256_001) },
      columnCount: 1,
      rowCount: 1,
    });

    await assert.rejects(
      () =>
        harness.service.getWorkbookSnapshotCells({
          columnCount: 1,
          currentUser: currentUser(ownerUserId),
          rowCount: 1,
          sheetIndex: 0,
          startColumn: 1,
          startRow: 1,
          workbookSnapshotId: targetSnapshotId,
        }),
      InvalidWorkbookSnapshotReferenceError,
    );
  });

  it("denies snapshots for other users", async () => {
    const harness = createHarness();

    await assert.rejects(
      () =>
        harness.service.getWorkbookSnapshot({
          currentUser: currentUser(otherUserId),
          workbookSnapshotId: targetSnapshotId,
        }),
      ForbiddenWorkbookActionError,
    );
  });

  it("returns source-aware snapshot identifiers", async () => {
    const harness = createHarness();

    const result = await harness.service.getWorkbookSnapshot({
      currentUser: currentUser(ownerUserId),
      workbookSnapshotId: targetSnapshotId,
    });

    assert.equal(result.workbookSnapshot.sourceId, "primary");
    assert.equal(result.workbookSnapshot.questionIndex, 0);
    assert.equal(result.workbookSnapshot.snapshotIndex, 0);
  });
});

function createHarness(
  snapshotInput: {
    cells?: Record<string, string>;
    rowCount?: number;
    columnCount?: number;
  } = {},
) {
  const repository = new FakeWorkbookRepository();
  repository.calculations.set(targetCalculationId, createCalculation());
  repository.snapshots.set(targetSnapshotId, createSnapshot(snapshotInput));
  return {
    repository,
    service: new WorkbookSnapshotService({ workbookRepository: repository }),
  };
}

function createCalculation(): WorkbookCalculation {
  return createInitialWorkbookCalculation(
    {
      correlationId: null,
      createdByUserId: ownerUserId,
      id: targetCalculationId,
      ownerUserId,
      requestedCount: 1,
    },
    at,
  );
}

function createSnapshot(
  input: {
    cells?: Record<string, string>;
    rowCount?: number;
    columnCount?: number;
  } = {},
): WorkbookSnapshot {
  const cells = input.cells ?? { A1: "42", B2: "84" };
  return createWorkbookSnapshot(
    {
      calculationId: targetCalculationId,
      id: targetSnapshotId,
      questionIndex: 0,
      snapshotIndex: 0,
      sourceId: "primary",
      values: {
        sheets: [
          {
            cells,
            cellTypes: { A1: "number", B2: "number" },
            columnCount: input.columnCount ?? 2,
            name: "Sheet1",
            rowCount: input.rowCount ?? 2,
          },
        ],
      },
      workbookId: targetWorkbookId,
    },
    at,
  );
}

function currentUser(id: typeof ownerUserId): CurrentUser {
  return {
    isAdmin: false,
    roles: [],
    user: createUser(
      {
        displayName: "Test User",
        email: `${id}@example.com`,
        id,
        identityId: `oidc:${id}`,
      },
      at,
    ),
  };
}

class FakeWorkbookRepository implements WorkbookRepository {
  readonly calculations = new Map<string, WorkbookCalculation>();
  readonly snapshots = new Map<string, WorkbookSnapshot>();

  async findWorkbookCalculationById(
    id: WorkbookCalculation["id"],
  ): Promise<WorkbookCalculation | null> {
    return this.calculations.get(id) ?? null;
  }

  async findWorkbookSnapshotById(
    id: WorkbookSnapshot["id"],
  ): Promise<WorkbookSnapshot | null> {
    return this.snapshots.get(id) ?? null;
  }

  async listWorkbookSnapshotsByCalculationId(input: {
    calculationId: WorkbookCalculation["id"];
    limit: number;
  }): Promise<WorkbookSnapshot[]> {
    return [...this.snapshots.values()]
      .filter((snapshot) => snapshot.calculationId === input.calculationId)
      .slice(0, input.limit);
  }

  async listWorkbookSnapshotMetadataForCalculation(): Promise<[]> {
    throw new Error("Not implemented.");
  }

  async listWorkbookCalculationSources() {
    return [];
  }

  async listWorkbooksByOwnerUserId(): Promise<Workbook[]> {
    throw new Error("Not implemented.");
  }

  async findWorkbookById(): Promise<Workbook | null> {
    throw new Error("Not implemented.");
  }

  async createWorkbook(): Promise<Workbook> {
    throw new Error("Not implemented.");
  }

  async createWorkbookIfAbsentByOwnerAndFile(): Promise<{
    workbook: Workbook;
    created: boolean;
  }> {
    throw new Error("Not implemented.");
  }

  async updateWorkbook(): Promise<Workbook | null> {
    throw new Error("Not implemented.");
  }

  async listWorkbookCalculationsByOwnerUserId(): Promise<
    WorkbookCalculation[]
  > {
    throw new Error("Not implemented.");
  }

  async listWorkbookCalculationsByWorkbookId(): Promise<WorkbookCalculation[]> {
    throw new Error("Not implemented.");
  }

  async findWorkbookCalculationByCorrelationId(): Promise<WorkbookCalculation | null> {
    throw new Error("Not implemented.");
  }

  async createWorkbookCalculationWithSources(): Promise<WorkbookCalculation> {
    throw new Error("Not implemented.");
  }

  async updateWorkbookCalculation(): Promise<WorkbookCalculation | null> {
    throw new Error("Not implemented.");
  }

  async claimQueuedWorkbookCalculation(): Promise<WorkbookCalculation | null> {
    throw new Error("Not implemented.");
  }

  async createWorkbookSnapshots(): Promise<WorkbookSnapshot[]> {
    throw new Error("Not implemented.");
  }

  async completeWorkbookCalculation(): Promise<{
    calculation: WorkbookCalculation;
    snapshots: WorkbookSnapshot[];
  }> {
    throw new Error("Not implemented.");
  }
}
