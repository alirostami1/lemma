import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import {
  createWorkbookCalculation,
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
      workbookCalculationId: targetCalculationId,
      limit: 10,
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
        workbookSnapshotId: targetSnapshotId,
        source: { type: "cell", ref: "Sheet1!A1" },
      });

    assert.equal(result.value, "42");
  });

  it("lists snapshot sheets for the owner", async () => {
    const harness = createHarness();

    const result = await harness.service.listWorkbookSnapshotSheets({
      currentUser: currentUser(ownerUserId),
      workbookSnapshotId: targetSnapshotId,
      limit: 1,
    });

    assert.deepEqual(result, {
      workbookSnapshotSheets: [
        {
          sheetIndex: 0,
          name: "Sheet1",
          rowCount: 2,
          columnCount: 2,
          nonEmptyCellCount: 2,
        },
      ],
      nextCursor: null,
    });
  });

  it("returns snapshot metadata for the owner", async () => {
    const harness = createHarness();

    const result = await harness.service.getWorkbookSnapshotMetadata({
      currentUser: currentUser(ownerUserId),
      workbookSnapshotId: targetSnapshotId,
    });

    assert.deepEqual(result.workbookSnapshotMetadata, {
      status: "ready",
      sheetCount: 1,
      cellCount: 2,
    });
  });

  it("returns displayed sheet cells with type metadata", async () => {
    const harness = createHarness();

    const result = await harness.service.getWorkbookSnapshotCells({
      currentUser: currentUser(ownerUserId),
      workbookSnapshotId: targetSnapshotId,
      sheetIndex: 0,
      startRow: 1,
      startColumn: 1,
      rowCount: 2,
      columnCount: 2,
    });

    assert.deepEqual(result.workbookSnapshotCells, {
      sheetIndex: 0,
      sheetName: "Sheet1",
      startRow: 1,
      startColumn: 1,
      rowCount: 2,
      columnCount: 2,
      rows: [
        ["42", ""],
        ["", "84"],
      ],
      cellTypes: [
        ["number", "blank"],
        ["blank", "number"],
      ],
    });
  });

  it("returns selected ranges with normalized references", async () => {
    const harness = createHarness();

    const result = await harness.service.getWorkbookSnapshotRange({
      currentUser: currentUser(ownerUserId),
      workbookSnapshotId: targetSnapshotId,
      ref: "Sheet1!A1:B2",
    });

    assert.deepEqual(result.workbookSnapshotRange, {
      sheetIndex: 0,
      sheetName: "Sheet1",
      startRow: 1,
      startColumn: 1,
      rowCount: 2,
      columnCount: 2,
      rows: [
        ["42", ""],
        ["", "84"],
      ],
      cellTypes: [
        ["number", "blank"],
        ["blank", "number"],
      ],
      ref: "'Sheet1'!A1:B2",
      startCellAddress: "A1",
      endCellAddress: "B2",
    });
  });

  it("rejects sheet page limits outside the public bounds", async () => {
    const harness = createHarness();

    await assert.rejects(
      () =>
        harness.service.listWorkbookSnapshotSheets({
          currentUser: currentUser(ownerUserId),
          workbookSnapshotId: targetSnapshotId,
          limit: 0,
        }),
      InvalidWorkbookSnapshotReferenceError,
    );
  });

  it("rejects snapshot ranges outside public bounds", async () => {
    const harness = createHarness();

    await assert.rejects(
      () =>
        harness.service.getWorkbookSnapshotCells({
          currentUser: currentUser(ownerUserId),
          workbookSnapshotId: targetSnapshotId,
          sheetIndex: 0,
          startRow: 1,
          startColumn: 1,
          rowCount: 1,
          columnCount: 51,
        }),
      InvalidWorkbookSnapshotReferenceError,
    );
  });

  it("rejects cell windows above the total cell cap", async () => {
    const harness = createHarness();

    await assert.rejects(
      () =>
        harness.service.getWorkbookSnapshotCells({
          currentUser: currentUser(ownerUserId),
          workbookSnapshotId: targetSnapshotId,
          sheetIndex: 0,
          startRow: 1,
          startColumn: 1,
          rowCount: 100,
          columnCount: 50,
        }),
      InvalidWorkbookSnapshotReferenceError,
    );
  });

  it("rejects cell windows above the value byte cap", async () => {
    const harness = createHarness({
      cells: { A1: "x".repeat(256_001) },
      rowCount: 1,
      columnCount: 1,
    });

    await assert.rejects(
      () =>
        harness.service.getWorkbookSnapshotCells({
          currentUser: currentUser(ownerUserId),
          workbookSnapshotId: targetSnapshotId,
          sheetIndex: 0,
          startRow: 1,
          startColumn: 1,
          rowCount: 1,
          columnCount: 1,
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
  return createWorkbookCalculation(
    {
      id: targetCalculationId,
      ownerUserId,
      createdByUserId: ownerUserId,
      workbookId: targetWorkbookId,
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
      id: targetSnapshotId,
      workbookId: targetWorkbookId,
      calculationId: targetCalculationId,
      snapshotIndex: 0,
      values: {
        sheets: [
          {
            name: "Sheet1",
            cells,
            cellTypes: { A1: "number", B2: "number" },
            rowCount: input.rowCount ?? 2,
            columnCount: input.columnCount ?? 2,
          },
        ],
      },
    },
    at,
  );
}

function currentUser(id: typeof ownerUserId): CurrentUser {
  return {
    user: createUser(
      {
        id,
        identityId: `oidc:${id}`,
        email: `${id}@example.com`,
        displayName: "Test User",
      },
      at,
    ),
    roles: [],
    isAdmin: false,
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

  async listWorkbooksByOwnerUserId(): Promise<Workbook[]> {
    throw new Error("Not implemented.");
  }

  async findWorkbookById(): Promise<Workbook | null> {
    throw new Error("Not implemented.");
  }

  async createWorkbook(): Promise<Workbook> {
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

  async createWorkbookCalculation(): Promise<WorkbookCalculation> {
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
