import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rootOperationLineage } from "@lemma/domain";
import type { OutboxRepository } from "@lemma/events/application";
import {
  type DomainEventEnvelope,
  eventId as toEventId,
} from "@lemma/events/domain";
import {
  createWorkbookCalculation,
  createWorkbook as createWorkbookDomain,
  fileId,
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
const workbookSources = [
  {
    sourceId: "019e9315-6a87-715f-9861-8654df070c10",
    workbookId: targetWorkbookId,
  },
] as const;

describe("WorkbookCalculationRequestAdapter", () => {
  it("returns an existing calculation for the same correlation id", async () => {
    const harness = createHarness();
    const existing = createWorkbookCalculation(
      {
        id: existingCalculationId,
        ownerUserId,
        createdByUserId,
        workbookId: targetWorkbookId,
        requestedCount: 3,
        correlationId: "019e9315-6a87-715f-9861-8654df070c08",
      },
      at,
    );
    harness.repository.calculations.set(existing.id, existing);

    const result = await harness.adapter.requestCalculation({
      createdByUserId,
      workbookId: targetWorkbookId,
      workbookSources,
      requestedCount: 3,
      correlationId: existing.correlationId,
      lineage,
    });

    assert.equal(result.workbookCalculationId, existing.id);
    assert.equal(harness.repository.createdCalculations.length, 0);
    assert.equal(harness.transaction.outboxEvents.length, 0);
  });

  it("creates a calculation and appends one requested event", async () => {
    const harness = createHarness();

    const result = await harness.adapter.requestCalculation({
      createdByUserId,
      workbookId: targetWorkbookId,
      workbookSources,
      requestedCount: 5,
      correlationId: "019e9315-6a87-715f-9861-8654df070c09",
      lineage,
    });

    assert.equal(result.workbookCalculationId, nextCalculationId);
    assert.equal(harness.repository.createdCalculations.length, 1);
    assert.equal(harness.transaction.outboxEvents.length, 1);
    assert.equal(
      harness.transaction.outboxEvents[0]?.type,
      WORKBOOK_CALCULATION_REQUESTED_EVENT,
    );
    assert.deepEqual(harness.transaction.outboxEvents[0]?.payload, {
      workbookCalculationId: nextCalculationId,
      workbookId: targetWorkbookId,
      workbookSources: [...workbookSources],
      requestedCount: 5,
      correlationId: "019e9315-6a87-715f-9861-8654df070c09",
    } satisfies WorkbookCalculationRequestedPayload);
  });
});

function createHarness() {
  const repository = new FakeWorkbookRepository();
  repository.workbooks.set(targetWorkbookId, createValidWorkbook());
  const transaction = new FakeWorkbookTransaction(repository);
  const adapter = new WorkbookCalculationRequestAdapter({
    workbookRepository: repository,
    workbookTransaction: transaction,
    idGenerator: fakeIdGenerator,
    clock,
  });

  return { adapter, repository, transaction };
}

const clock: Clock = {
  now: () => at,
};

const fakeIdGenerator: IdGenerator = {
  eventId: () => nextEventId,
  workbookId: () => workbookId("019e9315-6a87-715f-9861-8654df070c10"),
  workbookCalculationId: () => nextCalculationId,
  workbookSnapshotId: () =>
    workbookSnapshotId("019e9315-6a87-715f-9861-8654df070c11"),
};

function createValidWorkbook(): Workbook {
  return markWorkbookValid(
    createWorkbookDomain(
      {
        id: targetWorkbookId,
        ownerUserId,
        createdByUserId,
        name: "Workbook",
        fileId: fileId("019e9315-6a87-715f-9861-8654df070c12"),
        checksumSha256: "checksum",
        originalName: "workbook.xlsx",
        engine: "libreoffice",
      },
      at,
    ),
    {
      sheetCount: 1,
      cellCount: 1,
      formulaCount: 0,
      forbiddenFeatureFindings: [],
      libreOfficeVersion: "25.2",
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
      workbookRepository: WorkbookRepository;
      outboxRepository: OutboxRepository;
    }) => Promise<T>,
  ): Promise<T> {
    return fn({
      workbookRepository: this.repository,
      outboxRepository: new FakeOutboxRepository(this.outboxEvents),
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

  async createWorkbookCalculation(
    calculation: WorkbookCalculation,
  ): Promise<WorkbookCalculation> {
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
