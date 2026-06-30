import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutboxRepository } from "@lemma/events/application";
import { eventId } from "@lemma/events/domain";
import {
  createWorkbook,
  fileId,
  InvalidWorkbookFieldError,
  InvalidWorkbookFileMetadataError,
  userId,
  type Workbook,
  workbookId,
  workbookSourceFileInspection,
} from "../domain/index.js";
import { DraftSourceWorkbookRegistrationService } from "./DraftSourceWorkbookRegistrationService.js";
import type {
  DraftSourceInspectedWorkbookRegistrationCommand,
  DraftSourceWorkbookRegistrationCommand,
  WorkbookCalculator,
  WorkbookFileProviderPort,
  WorkbookRepository,
} from "./ports.js";

const at = new Date("2026-06-26T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df090201");
const createdByUserId = userId("019e9315-6a87-715f-9861-8654df090202");
const persistedWorkbook = createWorkbook(
  {
    checksumSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    createdByUserId,
    engine: "libreoffice",
    fileId: fileId("019e9315-6a87-715f-9861-8654df090203"),
    id: workbookId("019e9315-6a87-715f-9861-8654df090204"),
    name: "Source A",
    originalName: "source.xlsx",
    ownerUserId,
  },
  at,
);

describe("DraftSourceWorkbookRegistrationService", () => {
  it("creates workbook and appends one validation requested event", async () => {
    const workbookRepository = new FakeWorkbookRepository({
      created: true,
      workbook: persistedWorkbook,
    });
    const outboxRepository = new FakeOutboxRepository();
    const service = createRegistrationService({
      outboxRepository,
      workbookRepository,
    });

    const result = await service.registerInspectedWorkbookFromFile(
      inspectedCommand(),
    );

    assert.equal(result.workbookId, persistedWorkbook.id);
    assert.equal(result.status, "pending_validation");
    assert.deepEqual(result.inspection.referenceTargetAvailability, {
      status: "available",
      targets: referenceTargetsFixture(),
    });
    assert.equal(outboxRepository.events.length, 1);
    assert.equal(workbookRepository.calls.length, 1);
    assert.equal(workbookRepository.calls[0]?.origin, "source_artifact");
  });

  it("returns existing workbook state without appending a new event", async () => {
    const existingWorkbook = {
      ...persistedWorkbook,
      status: "invalid" as const,
      validationError: "bad workbook",
    };
    const workbookRepository = new FakeWorkbookRepository({
      created: false,
      workbook: existingWorkbook,
    });
    const outboxRepository = new FakeOutboxRepository();
    const service = createRegistrationService({
      outboxRepository,
      workbookRepository,
    });

    const result = await service.registerInspectedWorkbookFromFile(
      inspectedCommand({
        inspection: workbookSourceFileInspection({
          ...inspectionFileMetadata(),
          referenceTargetAvailability: {
            reason: "invalid_workbook",
            status: "unavailable",
          },
          validation: {
            status: "invalid",
            validationError: "bad workbook",
          },
        }),
      }),
    );

    assert.equal(result.workbookId, existingWorkbook.id);
    assert.equal(result.status, "invalid");
    assert.equal(result.validationError, "bad workbook");
    assert.equal(outboxRepository.events.length, 0);
    assert.equal(workbookRepository.calls.length, 1);
  });

  it("returns existing valid workbook state unchanged", async () => {
    const workbookRepository = new FakeWorkbookRepository({
      created: false,
      workbook: {
        ...persistedWorkbook,
        status: "valid",
        validationError: null,
      },
    });
    const outboxRepository = new FakeOutboxRepository();
    const service = createRegistrationService({
      outboxRepository,
      workbookRepository,
    });

    const result = await service.registerInspectedWorkbookFromFile(
      inspectedCommand(),
    );

    assert.equal(result.status, "valid");
    assert.equal(result.validationError, null);
    assert.equal(outboxRepository.events.length, 0);
  });

  it("reuses workbook file validation rules during draft-source registration", async () => {
    const workbookRepository = new FakeWorkbookRepository({
      created: true,
      workbook: persistedWorkbook,
    });
    const service = createRegistrationService({
      workbookRepository,
    });

    await assert.rejects(
      () =>
        service.registerInspectedWorkbookFromFile(
          inspectedCommand({ contentType: "text/plain" }),
        ),
      InvalidWorkbookFileMetadataError,
    );
    assert.equal(workbookRepository.calls.length, 0);
  });

  it("can inspect workbook reference targets without creating workbook rows or events", async () => {
    const workbookRepository = new FakeWorkbookRepository({
      created: true,
      workbook: persistedWorkbook,
    });
    const outboxRepository = new FakeOutboxRepository();
    const service = createRegistrationService({
      outboxRepository,
      workbookRepository,
    });

    const result = await service.inspectWorkbookSourceFile({
      fileId: command().fileId,
      lineage: command().lineage,
      ownerUserId,
    });

    assert.deepEqual(result, {
      ...inspectionFileMetadata(),
      referenceTargetAvailability: {
        status: "available",
        targets: referenceTargetsFixture(),
      },
      referenceTargets: referenceTargetsFixture(),
      schemaVersion: 1,
      validation: { status: "valid" },
    });
    assert.equal(workbookRepository.calls.length, 0);
    assert.equal(outboxRepository.events.length, 0);
  });

  it("returns known unavailable workbook state without reading content or running inspection", async () => {
    for (const status of ["invalid", "archived", "deleted"] as const) {
      let contentReadCount = 0;
      let inspectionCount = 0;
      const workbookRepository = new FakeWorkbookRepository({
        created: false,
        workbook: {
          ...persistedWorkbook,
          status,
          validationError: status === "invalid" ? "bad workbook" : null,
        },
      });
      const service = createRegistrationService({
        workbookCalculator: {
          ...fakeWorkbookCalculator(),
          referenceTargets: async () => {
            inspectionCount += 1;
            return {
              status: "available",
              targets: referenceTargetsFixture(),
            };
          },
        },
        workbookFileProvider: {
          ...fakeWorkbookFileProvider(),
          readWorkbookFileContentForOwnerUserId: async () => {
            contentReadCount += 1;
            throw new Error("content should not be read");
          },
        },
        workbookRepository,
      });

      const result = await service.inspectWorkbookSourceFile({
        fileId: command().fileId,
        lineage: command().lineage,
        ownerUserId,
      });

      assert.deepEqual(result.referenceTargetAvailability, {
        reason: "invalid_workbook",
        status: "unavailable",
      });
      assert.equal(result.validation.status, "invalid");
      assert.equal(contentReadCount, 0);
      assert.equal(inspectionCount, 0);
    }
  });

  it("maps reference target extraction failures to unavailable inspection", async () => {
    const workbookRepository = new FakeWorkbookRepository({
      created: true,
      workbook: persistedWorkbook,
    });
    const service = createRegistrationService({
      workbookCalculator: {
        ...fakeWorkbookCalculator(),
        referenceTargets: async () => {
          throw new Error("engine unavailable");
        },
      },
      workbookRepository,
    });

    const result = await service.inspectWorkbookSourceFile({
      fileId: command().fileId,
      lineage: command().lineage,
      ownerUserId,
    });

    assert.deepEqual(result.referenceTargetAvailability, {
      reason: "inspection_unavailable",
      status: "unavailable",
    });
  });

  it("registers inspected workbook without inspecting again", async () => {
    let inspectionCount = 0;
    const workbookRepository = new FakeWorkbookRepository({
      created: true,
      workbook: persistedWorkbook,
    });
    const service = createRegistrationService({
      workbookCalculator: {
        ...fakeWorkbookCalculator(),
        referenceTargets: async () => {
          inspectionCount += 1;
          return {
            reason: "inspection_unavailable",
            status: "unavailable",
          };
        },
      },
      workbookRepository,
    });

    const result = await service.registerInspectedWorkbookFromFile(
      inspectedCommand(),
    );

    assert.equal(inspectionCount, 0);
    assert.deepEqual(result.inspection.referenceTargetAvailability, {
      status: "available",
      targets: referenceTargetsFixture(),
    });
  });

  it("rejects registration when inspection belongs to a different file", async () => {
    const workbookRepository = new FakeWorkbookRepository({
      created: true,
      workbook: persistedWorkbook,
    });
    const service = createRegistrationService({
      workbookRepository,
    });

    await assert.rejects(
      () =>
        service.registerInspectedWorkbookFromFile(
          inspectedCommand({
            inspection: workbookSourceFileInspection({
              ...inspectionFileMetadata({
                checksumSha256:
                  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              }),
              referenceTargetAvailability: {
                status: "available",
                targets: referenceTargetsFixture(),
              },
            }),
          }),
        ),
      InvalidWorkbookFieldError,
    );
    assert.equal(workbookRepository.calls.length, 0);
  });
});

function createRegistrationService(input: {
  workbookRepository: FakeWorkbookRepository;
  outboxRepository?: FakeOutboxRepository;
  workbookCalculator?: WorkbookCalculator;
  workbookFileProvider?: WorkbookFileProviderPort;
}) {
  return new DraftSourceWorkbookRegistrationService({
    clock: { now: () => at },
    eventId: () => eventId("019e9315-6a87-715f-9861-8654df090205"),
    outboxRepository: (input.outboxRepository ??
      new FakeOutboxRepository()) as OutboxRepository,
    workbookCalculator: input.workbookCalculator ?? fakeWorkbookCalculator(),
    workbookEngine: "libreoffice",
    workbookFileProvider:
      input.workbookFileProvider ?? fakeWorkbookFileProvider(),
    workbookId: () => workbookId("019e9315-6a87-715f-9861-8654df090206"),
    workbookRepository: input.workbookRepository,
  });
}

function fakeWorkbookCalculator(): WorkbookCalculator {
  return {
    calculate: async () => ({ schemaVersion: 1, sheets: [] }),
    calculateBatch: async () => [],
    health: async () => ({
      engine: "libreoffice",
      ok: true,
      version: "test",
    }),
    inspect: async () => ({
      cellCount: 0,
      forbiddenFeatureFindings: [],
      formulaCount: 0,
      libreOfficeVersion: "test",
      sheetCount: 0,
    }),
    referenceTargets: async () => ({
      status: "available",
      targets: referenceTargetsFixture(),
    }),
  };
}

function fakeWorkbookFileProvider(): WorkbookFileProviderPort {
  const metadata = {
    byteSize: 1234,
    checksumSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileId: fileId("019e9315-6a87-715f-9861-8654df090203"),
    originalName: "source.xlsx",
  };
  return {
    getWorkbookFileMetadata: async () => metadata,
    getWorkbookFileMetadataForOwnerUserId: async () => metadata,
    readWorkbookFileContent: async () => ({
      ...metadata,
      bytes: new Uint8Array([1, 2, 3]),
    }),
    readWorkbookFileContentForOwnerUserId: async () => ({
      ...metadata,
      bytes: new Uint8Array([1, 2, 3]),
    }),
  };
}

function referenceTargetsFixture() {
  return {
    schemaVersion: 1 as const,
    sheets: [
      {
        dimensions: { columnCount: 1, rowCount: 1 },
        name: "Sheet1",
        valueCells: ["A1"],
      },
    ],
  };
}

class FakeWorkbookRepository
  implements
    Pick<
      WorkbookRepository,
      | "createWorkbookIfAbsentByOwnerAndFile"
      | "findWorkbookByOwnerUserIdAndFileId"
    >
{
  readonly calls: Workbook[] = [];

  constructor(
    private readonly result: {
      workbook: Workbook;
      created: boolean;
    },
  ) {}

  async createWorkbookIfAbsentByOwnerAndFile(input: { workbook: Workbook }) {
    this.calls.push(input.workbook);
    return this.result;
  }

  async findWorkbookByOwnerUserIdAndFileId() {
    return this.result.created ? null : this.result.workbook;
  }
}

class FakeOutboxRepository {
  readonly events: unknown[] = [];

  async appendEvents(events: readonly unknown[]): Promise<void> {
    this.events.push(...events);
  }

  async claimPendingEvents(): Promise<[]> {
    return [];
  }

  async deletePublishedEventsBefore(): Promise<number> {
    return 0;
  }

  async findEventById(): Promise<null> {
    return null;
  }

  async listFailedEvents(): Promise<[]> {
    return [];
  }

  async markEventPublished(): Promise<void> {}

  async markEventFailed(): Promise<void> {}

  async hasProcessedEvent(): Promise<boolean> {
    return false;
  }

  async recordProcessedEvent() {
    return true;
  }
}

function inspectedCommand(
  patch: Partial<DraftSourceInspectedWorkbookRegistrationCommand> = {},
): DraftSourceInspectedWorkbookRegistrationCommand {
  return {
    ...command(patch),
    inspection:
      patch.inspection ??
      workbookSourceFileInspection({
        ...inspectionFileMetadata(),
        referenceTargetAvailability: {
          status: "available",
          targets: referenceTargetsFixture(),
        },
      }),
  };
}

function inspectionFileMetadata(
  patch: Partial<{
    byteSize: number;
    checksumSha256: string;
    contentType: string;
    fileId: string;
  }> = {},
) {
  return {
    byteSize: 1234,
    checksumSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileId: "019e9315-6a87-715f-9861-8654df090203",
    ...patch,
  };
}

function command(
  patch: Partial<DraftSourceWorkbookRegistrationCommand> = {},
): DraftSourceWorkbookRegistrationCommand {
  return {
    byteSize: 1234,
    checksumSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    createdByUserId,
    fileId: "019e9315-6a87-715f-9861-8654df090203",
    lineage: {
      causationId: null,
      correlationId: "019e9315-6a87-715f-9861-8654df090207",
      requestId: "019e9315-6a87-715f-9861-8654df090208",
    },
    name: "Source A",
    originalName: "source.xlsx",
    ownerUserId,
    ...patch,
  };
}
