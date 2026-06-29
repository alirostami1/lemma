import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rootOperationLineage } from "@lemma/domain";
import type { OutboxRepository } from "@lemma/events/application";
import {
  type DomainEventEnvelope,
  eventId as toEventId,
} from "@lemma/events/domain";
import {
  createInitialWorkbookCalculation,
  createWorkbook as createWorkbookDomain,
  fileId,
  markWorkbookCalculationFailed,
  markWorkbookValid,
  userId,
  type Workbook,
  type WorkbookCalculation,
  type WorkbookSnapshot,
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
} from "../domain/index.js";
import type {
  Clock,
  IdGenerator,
  WorkbookRepository,
  WorkbookTransactionPort,
} from "./ports.js";
import { WorkbookCalculationRequestAdapter } from "./WorkbookCalculationRequestAdapter.js";
import {
  WORKBOOK_CALCULATION_REQUESTED_EVENT,
  type WorkbookCalculationRequestedPayload,
} from "./workbook-events.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df070c01");
const createdByUserId = userId("019e9315-6a87-715f-9861-8654df070c02");
const targetWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df070c03");
const existingCalculationId = workbookCalculationId(
  "019e9315-6a87-715f-9861-8654df070c04",
);
const nextCalculationId = workbookCalculationId(
  "019e9315-6a87-715f-9861-8654df070c05",
);
const nextEventId = toEventId("019e9315-6a87-715f-9861-8654df070c06");
const lineage = rootOperationLineage("019e9315-6a87-715f-9861-8654df070c07");
const sources = [
  {
    sourceId: "primary",
    workbookId: targetWorkbookId,
  },
] as const;

describe("WorkbookCalculationRequestAdapter", () => {
  it("returns an existing calculation for the same correlation id", async () => {
    const harness = createHarness();
    const existing = createInitialWorkbookCalculation(
      {
        correlationId: "019e9315-6a87-715f-9861-8654df070c08",
        createdByUserId,
        id: existingCalculationId,
        ownerUserId,
        requestedCount: 3,
      },
      at,
    );
    harness.repository.calculations.set(existing.id, existing);

    const result = await harness.adapter.requestCalculation({
      correlationId: existing.correlationId,
      createdByUserId,
      lineage,
      ownerUserId,
      requestedCount: 3,
      sources,
    });

    assert.equal(result.workbookCalculationId, existing.id);
    assert.equal(harness.repository.createdCalculations.length, 0);
    assert.equal(harness.transaction.outboxEvents.length, 0);
  });

  it("rejects failed correlation reuse with correlation and status details", async () => {
    const harness = createHarness();
    const correlationId = "019e9315-6a87-715f-9861-8654df070c08";
    const existing = markWorkbookCalculationFailed(
      createInitialWorkbookCalculation(
        {
          correlationId,
          createdByUserId,
          id: existingCalculationId,
          ownerUserId,
          requestedCount: 3,
        },
        at,
      ),
      "failed",
      at,
    );
    harness.repository.calculations.set(existing.id, existing);

    await assert.rejects(
      () =>
        harness.adapter.requestCalculation({
          correlationId,
          createdByUserId,
          lineage,
          ownerUserId,
          requestedCount: 3,
          sources,
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(correlationId) &&
        error.message.includes("failed"),
    );
    assert.equal(harness.repository.createdCalculations.length, 0);
  });

  it("creates a calculation and appends one requested event", async () => {
    const harness = createHarness();

    const result = await harness.adapter.requestCalculation({
      correlationId: "019e9315-6a87-715f-9861-8654df070c09",
      createdByUserId,
      lineage,
      ownerUserId,
      requestedCount: 5,
      sources,
    });

    assert.equal(result.workbookCalculationId, nextCalculationId);
    assert.equal(harness.repository.createdCalculations.length, 1);
    assert.equal(harness.transaction.outboxEvents.length, 1);
    assert.equal(
      harness.transaction.outboxEvents[0]?.type,
      WORKBOOK_CALCULATION_REQUESTED_EVENT,
    );
    assert.deepEqual(harness.transaction.outboxEvents[0]?.payload, {
      attemptNumber: 1,
      correlationId: "019e9315-6a87-715f-9861-8654df070c09",
      requestedCount: 5,
      retryOfCalculationId: null,
      sources: [...sources],
      workbookCalculationId: nextCalculationId,
    } satisfies WorkbookCalculationRequestedPayload);
  });

  it("rejects duplicate workbook source ids", async () => {
    const harness = createHarness();
    const [firstSource] = sources;
    assert.ok(firstSource);

    await assert.rejects(
      () =>
        harness.adapter.requestCalculation({
          correlationId: "019e9315-6a87-715f-9861-8654df070c0a",
          createdByUserId,
          lineage,
          ownerUserId,
          requestedCount: 5,
          sources: [
            firstSource,
            {
              sourceId: firstSource.sourceId,
              workbookId: workbookId("019e9315-6a87-715f-9861-8654df070c13"),
            },
          ],
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "sources sourceIds must be unique.",
    );
    assert.equal(harness.repository.createdCalculations.length, 0);
    assert.equal(harness.transaction.outboxEvents.length, 0);
  });

  it("rejects source ids with invalid pattern", async () => {
    const harness = createHarness();

    await assert.rejects(
      () =>
        harness.adapter.requestCalculation({
          correlationId: "019e9315-6a87-715f-9861-8654df070c0b",
          createdByUserId,
          lineage,
          ownerUserId,
          requestedCount: 5,
          sources: [
            {
              sourceId: "123bad",
              workbookId: targetWorkbookId,
            },
          ],
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          "sources[0].sourceId must start with a letter and contain only letters, numbers, underscores, or hyphens.",
    );
  });
});

function createHarness() {
  const repository = new FakeWorkbookRepository();
  repository.workbooks.set(targetWorkbookId, createValidWorkbook());
  const transaction = new FakeWorkbookTransaction(repository);
  const adapter = new WorkbookCalculationRequestAdapter({
    clock,
    idGenerator: fakeIdGenerator,
    workbookRepository: repository,
    workbookTransaction: transaction,
  });

  return { adapter, repository, transaction };
}

const clock: Clock = {
  now: () => at,
};

const fakeIdGenerator: IdGenerator = {
  eventId: () => nextEventId,
  workbookCalculationId: () => nextCalculationId,
  workbookId: () => workbookId("019e9315-6a87-715f-9861-8654df070c10"),
  workbookSnapshotId: () =>
    workbookSnapshotId("019e9315-6a87-715f-9861-8654df070c11"),
};

function createValidWorkbook(): Workbook {
  return markWorkbookValid(
    createWorkbookDomain(
      {
        checksumSha256: "checksum",
        createdByUserId,
        engine: "libreoffice",
        fileId: fileId("019e9315-6a87-715f-9861-8654df070c12"),
        id: targetWorkbookId,
        name: "Workbook",
        originalName: "workbook.xlsx",
        ownerUserId,
      },
      at,
    ),
    {
      cellCount: 1,
      forbiddenFeatureFindings: [],
      formulaCount: 0,
      libreOfficeVersion: "25.2",
      sheetCount: 1,
    },
    "25.2",
    at,
  );
}

class FakeWorkbookTransaction implements WorkbookTransactionPort {
  readonly outboxEvents: DomainEventEnvelope[] = [];

  constructor(private readonly repository: WorkbookRepository) {}

  async transaction<T>(
    fn: (deps: {
      fileReferenceGuard: {
        assertFileAliasReferenceableForUpdate(fileId: string): Promise<void>;
      };
      workbookRepository: WorkbookRepository;
      outboxRepository: OutboxRepository;
    }) => Promise<T>,
  ): Promise<T> {
    return fn({
      fileReferenceGuard: {
        async assertFileAliasReferenceableForUpdate() {},
      },
      outboxRepository: new FakeOutboxRepository(this.outboxEvents),
      workbookRepository: this.repository,
    });
  }
}

class FakeOutboxRepository implements OutboxRepository {
  constructor(private readonly events: DomainEventEnvelope[]) {}

  async appendEvents(events: readonly DomainEventEnvelope[]): Promise<void> {
    this.events.push(...events);
  }

  async claimPendingEvents(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async markEventPublished(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async markEventFailed(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async findEventById(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async listFailedEvents(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async deletePublishedEventsBefore(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async hasProcessedEvent(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async recordProcessedEvent(): Promise<never> {
    throw new Error("Not implemented.");
  }
}

class FakeWorkbookRepository implements WorkbookRepository {
  readonly workbooks = new Map<string, Workbook>();
  readonly calculations = new Map<string, WorkbookCalculation>();
  readonly createdCalculations: WorkbookCalculation[] = [];

  async findWorkbookById(id: Workbook["id"]): Promise<Workbook | null> {
    return this.workbooks.get(id) ?? null;
  }

  async findWorkbookCalculationByCorrelationId(
    correlationId: string,
  ): Promise<WorkbookCalculation | null> {
    return (
      [...this.calculations.values()].find(
        (calculation) => calculation.correlationId === correlationId,
      ) ?? null
    );
  }

  async createWorkbookCalculationWithSources(input: {
    calculation: WorkbookCalculation;
    sources: readonly unknown[];
  }): Promise<WorkbookCalculation> {
    const { calculation } = input;
    this.createdCalculations.push(calculation);
    this.calculations.set(calculation.id, calculation);
    return calculation;
  }

  async listWorkbooksByOwnerUserId(): Promise<Workbook[]> {
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

  async findWorkbookByOwnerUserIdAndFileId(): Promise<Workbook | null> {
    throw new Error("Not implemented.");
  }

  async findWorkbookByOwnerUserIdAndFileIdForUpdate(): Promise<Workbook | null> {
    throw new Error("Not implemented.");
  }

  async promoteWorkbookToStandalone(): Promise<Workbook | null> {
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

  async findWorkbookCalculationById(): Promise<WorkbookCalculation | null> {
    throw new Error("Not implemented.");
  }

  async updateWorkbookCalculation(): Promise<WorkbookCalculation | null> {
    throw new Error("Not implemented.");
  }

  async claimQueuedWorkbookCalculation(): Promise<WorkbookCalculation | null> {
    throw new Error("Not implemented.");
  }

  async findWorkbookSnapshotById(): Promise<WorkbookSnapshot | null> {
    throw new Error("Not implemented.");
  }

  async listWorkbookSnapshotsByCalculationId(): Promise<WorkbookSnapshot[]> {
    throw new Error("Not implemented.");
  }

  async listWorkbookSnapshotMetadataForCalculation(): Promise<[]> {
    throw new Error("Not implemented.");
  }

  async listWorkbookCalculationSources() {
    return [];
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
