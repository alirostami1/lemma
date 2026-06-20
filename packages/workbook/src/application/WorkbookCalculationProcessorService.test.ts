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
  WorkbookCalculator,
  WorkbookFileProviderPort,
  WorkbookRepository,
  WorkbookTransactionPort,
} from "./ports.js";
import { WorkbookCalculationProcessorService } from "./WorkbookCalculationProcessorService.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df070c20");
const createdByUserId = userId("019e9315-6a87-715f-9861-8654df070c21");
const primaryWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df070c22");
const calculationId = workbookCalculationId(
  "019e9315-6a87-715f-9861-8654df070c23",
);
const lineage = rootOperationLineage("019e9315-6a87-715f-9861-8654df070c24");

describe("WorkbookCalculationProcessorService", () => {
  it("does not fall back to the calculation workbook when workbookSources is empty", async () => {
    const repository = new FakeWorkbookRepository();
    const transaction = new FakeWorkbookTransaction(repository);
    const calculator = new FakeWorkbookCalculator();
    const service = new WorkbookCalculationProcessorService({
      workbookRepository: repository,
      workbookTransaction: transaction,
      workbookFileProvider: fakeWorkbookFileProvider,
      workbookCalculator: calculator,
      idGenerator: fakeIdGenerator,
      clock,
    });

    repository.runningCalculation = createWorkbookCalculation(
      {
        id: calculationId,
        ownerUserId,
        createdByUserId,
        workbookId: primaryWorkbookId,
        requestedCount: 2,
        correlationId: null,
      },
      at,
    );
    repository.workbooks.set(
      primaryWorkbookId,
      createValidWorkbook(primaryWorkbookId),
    );

    await service.processWorkbookCalculation({
      workbookCalculationId: calculationId,
      workbookSources: [],
      lineage,
    });

    assert.deepEqual(repository.findWorkbookByIdCalls, []);
    assert.equal(calculator.calculateBatchCalls, 0);
    assert.deepEqual(repository.completedSnapshots, []);
  });
});

const clock: Clock = {
  now: () => at,
};

const fakeIdGenerator: IdGenerator = {
  eventId: () => toEventId("019e9315-6a87-715f-9861-8654df070c25"),
  workbookId: () => workbookId("019e9315-6a87-715f-9861-8654df070c26"),
  workbookCalculationId: () =>
    workbookCalculationId("019e9315-6a87-715f-9861-8654df070c27"),
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
    fileId: fileId("019e9315-6a87-715f-9861-8654df070c29"),
    originalName: "workbook.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    byteSize: 0,
    checksumSha256: "checksum",
    bytes: new Uint8Array(),
  }),
};

class FakeWorkbookCalculator implements WorkbookCalculator {
  calculateBatchCalls = 0;

  async inspect(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async calculate(): Promise<never> {
    throw new Error("Not implemented.");
  }

  async calculateBatch(): Promise<WorkbookSnapshot["values"][]> {
    this.calculateBatchCalls += 1;
    return [];
  }

  async health(): Promise<never> {
    throw new Error("Not implemented.");
  }
}

function createValidWorkbook(id: ReturnType<typeof workbookId>): Workbook {
  return markWorkbookValid(
    createWorkbookDomain(
      {
        id,
        ownerUserId,
        createdByUserId,
        name: "Workbook",
        fileId: fileId("019e9315-6a87-715f-9861-8654df070c30"),
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
  readonly findWorkbookByIdCalls: string[] = [];
  completedSnapshots: readonly WorkbookSnapshot[] = [];
  runningCalculation: WorkbookCalculation | null = null;

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

  async createWorkbookCalculation(): Promise<WorkbookCalculation> {
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
