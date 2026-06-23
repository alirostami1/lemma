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
  WorkbookCalculationSourceRecord,
  WorkbookCalculator,
  WorkbookFileProviderPort,
  WorkbookRepository,
  WorkbookTransactionPort,
} from "./ports.js";
import { WorkbookCalculationProcessorService } from "./WorkbookCalculationProcessorService.js";
import { WORKBOOK_CALCULATION_FAILED_EVENT } from "./workbook-events.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df070c20");
const createdByUserId = userId("019e9315-6a87-715f-9861-8654df070c21");
const primaryWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df070c22");
const calculationId = workbookCalculationId(
  "019e9315-6a87-715f-9861-8654df070c23",
);
const lineage = rootOperationLineage("019e9315-6a87-715f-9861-8654df070c24");

describe("WorkbookCalculationProcessorService", () => {
  it("creates source-aware snapshots for each requested question", async () => {
    const repository = new FakeWorkbookRepository();
    const transaction = new FakeWorkbookTransaction(repository);
    const calculator = new FakeWorkbookCalculator([
      {
        sheets: [
          { cells: { A1: "1" }, columnCount: 1, name: "Sheet1", rowCount: 1 },
        ],
      },
      {
        sheets: [
          { cells: { A1: "2" }, columnCount: 1, name: "Sheet1", rowCount: 1 },
        ],
      },
    ]);
    const service = new WorkbookCalculationProcessorService({
      clock,
      idGenerator: fakeIdGenerator,
      workbookCalculator: calculator,
      workbookFileProvider: fakeWorkbookFileProvider,
      workbookRepository: repository,
      workbookTransaction: transaction,
    });
    const secondWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df070c31");

    repository.runningCalculation = createInitialWorkbookCalculation(
      {
        correlationId: null,
        createdByUserId,
        id: calculationId,
        ownerUserId,
        requestedCount: 2,
      },
      at,
    );
    repository.workbooks.set(
      primaryWorkbookId,
      createValidWorkbook(primaryWorkbookId),
    );
    repository.workbooks.set(
      secondWorkbookId,
      createValidWorkbook(secondWorkbookId),
    );
    repository.sources = [
      {
        calculationId,
        createdAt: at,
        position: 0,
        sourceId: "alpha",
        workbookId: primaryWorkbookId,
      },
      {
        calculationId,
        createdAt: at,
        position: 1,
        sourceId: "beta",
        workbookId: secondWorkbookId,
      },
    ];

    await service.processWorkbookCalculation({
      lineage,
      workbookCalculationId: calculationId,
    });

    assert.equal(calculator.calculateBatchCalls, 2);
    assert.deepEqual(
      repository.completedSnapshots.map((snapshot) => ({
        questionIndex: snapshot.questionIndex,
        snapshotIndex: snapshot.snapshotIndex,
        sourceId: snapshot.sourceId,
        workbookId: snapshot.workbookId,
      })),
      [
        {
          questionIndex: 0,
          snapshotIndex: 0,
          sourceId: "alpha",
          workbookId: primaryWorkbookId,
        },
        {
          questionIndex: 0,
          snapshotIndex: 1,
          sourceId: "beta",
          workbookId: secondWorkbookId,
        },
        {
          questionIndex: 1,
          snapshotIndex: 2,
          sourceId: "alpha",
          workbookId: primaryWorkbookId,
        },
        {
          questionIndex: 1,
          snapshotIndex: 3,
          sourceId: "beta",
          workbookId: secondWorkbookId,
        },
      ],
    );
  });

  it("rejects empty source collections without falling back to the calculation workbook", async () => {
    const repository = new FakeWorkbookRepository();
    const transaction = new FakeWorkbookTransaction(repository);
    const calculator = new FakeWorkbookCalculator();
    const service = new WorkbookCalculationProcessorService({
      clock,
      idGenerator: fakeIdGenerator,
      workbookCalculator: calculator,
      workbookFileProvider: fakeWorkbookFileProvider,
      workbookRepository: repository,
      workbookTransaction: transaction,
    });

    repository.runningCalculation = createInitialWorkbookCalculation(
      {
        correlationId: null,
        createdByUserId,
        id: calculationId,
        ownerUserId,
        requestedCount: 2,
      },
      at,
    );
    repository.workbooks.set(
      primaryWorkbookId,
      createValidWorkbook(primaryWorkbookId),
    );

    await service.processWorkbookCalculation({
      lineage,
      workbookCalculationId: calculationId,
    });

    assert.deepEqual(repository.findWorkbookByIdCalls, []);
    assert.equal(calculator.calculateBatchCalls, 0);
    assert.deepEqual(repository.completedSnapshots, []);
    assert.equal(transaction.outboxEvents.length, 1);
    assert.equal(
      transaction.outboxEvents[0]?.type,
      WORKBOOK_CALCULATION_FAILED_EVENT,
    );
    assert.deepEqual(transaction.outboxEvents[0]?.payload.sources, []);
  });
});

const clock: Clock = {
  now: () => at,
};

const fakeIdGenerator: IdGenerator = {
  eventId: () => toEventId("019e9315-6a87-715f-9861-8654df070c25"),
  workbookCalculationId: () =>
    workbookCalculationId("019e9315-6a87-715f-9861-8654df070c27"),
  workbookId: () => workbookId("019e9315-6a87-715f-9861-8654df070c26"),
  workbookSnapshotId: () =>
    workbookSnapshotId("019e9315-6a87-715f-9861-8654df070c28"),
};

const fakeWorkbookFileProvider: WorkbookFileProviderPort = {
  getWorkbookFileMetadata: async () => {
    throw new Error("Not implemented.");
  },
  getWorkbookFileMetadataForOwnerUserId: async () => {
    throw new Error("Not implemented.");
  },
  readWorkbookFileContent: async () => {
    throw new Error("Not implemented.");
  },
  readWorkbookFileContentForOwnerUserId: async () => ({
    byteSize: 0,
    bytes: new Uint8Array(),
    checksumSha256: "checksum",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileId: fileId("019e9315-6a87-715f-9861-8654df070c29"),
    originalName: "workbook.xlsx",
  }),
};

class FakeWorkbookCalculator implements WorkbookCalculator {
  calculateBatchCalls = 0;

  constructor(private readonly result: WorkbookSnapshot["values"][] = []) {}

  async inspect(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async calculate(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async calculateBatch(): Promise<WorkbookSnapshot["values"][]> {
    this.calculateBatchCalls += 1;
    return this.result;
  }

  async health(): Promise<never> {
    throw new Error("Not implemented.");
  }
}

function createValidWorkbook(id: ReturnType<typeof workbookId>): Workbook {
  return markWorkbookValid(
    createWorkbookDomain(
      {
        checksumSha256: "checksum",
        createdByUserId,
        engine: "libreoffice",
        fileId: fileId("019e9315-6a87-715f-9861-8654df070c30"),
        id,
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
      workbookRepository: WorkbookRepository;
      outboxRepository: OutboxRepository;
    }) => Promise<T>,
  ): Promise<T> {
    return fn({
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
  readonly findWorkbookByIdCalls: string[] = [];
  completedSnapshots: readonly WorkbookSnapshot[] = [];
  runningCalculation: WorkbookCalculation | null = null;
  sources: WorkbookCalculationSourceRecord[] = [];

  async listWorkbooksByOwnerUserId(): Promise<Workbook[]> {
    throw new Error("Not implemented.");
  }

  async findWorkbookById(
    id: ReturnType<typeof workbookId>,
  ): Promise<Workbook | null> {
    this.findWorkbookByIdCalls.push(id);
    return this.workbooks.get(id) ?? null;
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

  async findWorkbookCalculationByCorrelationId(): Promise<WorkbookCalculation | null> {
    throw new Error("Not implemented.");
  }

  async createWorkbookCalculationWithSources(): Promise<WorkbookCalculation> {
    throw new Error("Not implemented.");
  }

  async updateWorkbookCalculation(
    calculation: WorkbookCalculation,
  ): Promise<WorkbookCalculation | null> {
    this.runningCalculation = calculation;
    return calculation;
  }

  async claimQueuedWorkbookCalculation(): Promise<WorkbookCalculation | null> {
    return this.runningCalculation;
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

  async listWorkbookCalculationSources(): Promise<
    WorkbookCalculationSourceRecord[]
  > {
    return this.sources;
  }

  async createWorkbookSnapshots(): Promise<WorkbookSnapshot[]> {
    throw new Error("Not implemented.");
  }

  async completeWorkbookCalculation(input: {
    calculation: WorkbookCalculation;
    snapshots: readonly WorkbookSnapshot[];
  }): Promise<{
    calculation: WorkbookCalculation;
    snapshots: WorkbookSnapshot[];
  }> {
    this.runningCalculation = input.calculation;
    this.completedSnapshots = input.snapshots;
    return {
      calculation: input.calculation,
      snapshots: [...input.snapshots],
    };
  }
}
