import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutboxRepository } from "@lemma/events/application";
import { eventId } from "@lemma/events/domain";
import {
  createWorkbook,
  fileId,
  InvalidWorkbookFileMetadataError,
  userId,
  type Workbook,
  workbookId,
} from "../domain/index.js";
import { DraftSourceWorkbookRegistrationService } from "./DraftSourceWorkbookRegistrationService.js";
import type {
  DraftSourceWorkbookRegistrationCommand,
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
    const service = new DraftSourceWorkbookRegistrationService({
      clock: { now: () => at },
      eventId: () => eventId("019e9315-6a87-715f-9861-8654df090205"),
      outboxRepository: outboxRepository as OutboxRepository,
      workbookEngine: "libreoffice",
      workbookId: () => workbookId("019e9315-6a87-715f-9861-8654df090206"),
      workbookRepository,
    });

    const result = await service.registerWorkbookFromFile(command());

    assert.equal(result.workbookId, persistedWorkbook.id);
    assert.equal(result.status, "pending_validation");
    assert.equal(outboxRepository.events.length, 1);
    assert.equal(workbookRepository.calls.length, 1);
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
    const service = new DraftSourceWorkbookRegistrationService({
      clock: { now: () => at },
      eventId: () => eventId("019e9315-6a87-715f-9861-8654df090205"),
      outboxRepository: outboxRepository as OutboxRepository,
      workbookEngine: "libreoffice",
      workbookId: () => workbookId("019e9315-6a87-715f-9861-8654df090206"),
      workbookRepository,
    });

    const result = await service.registerWorkbookFromFile(command());

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
    const service = new DraftSourceWorkbookRegistrationService({
      clock: { now: () => at },
      eventId: () => eventId("019e9315-6a87-715f-9861-8654df090205"),
      outboxRepository: outboxRepository as OutboxRepository,
      workbookEngine: "libreoffice",
      workbookId: () => workbookId("019e9315-6a87-715f-9861-8654df090206"),
      workbookRepository,
    });

    const result = await service.registerWorkbookFromFile(command());

    assert.equal(result.status, "valid");
    assert.equal(result.validationError, null);
    assert.equal(outboxRepository.events.length, 0);
  });

  it("reuses workbook file validation rules during draft-source registration", async () => {
    const workbookRepository = new FakeWorkbookRepository({
      created: true,
      workbook: persistedWorkbook,
    });
    const service = new DraftSourceWorkbookRegistrationService({
      clock: { now: () => at },
      eventId: () => eventId("019e9315-6a87-715f-9861-8654df090205"),
      outboxRepository: new FakeOutboxRepository() as OutboxRepository,
      workbookEngine: "libreoffice",
      workbookId: () => workbookId("019e9315-6a87-715f-9861-8654df090206"),
      workbookRepository,
    });

    await assert.rejects(
      () =>
        service.registerWorkbookFromFile(
          command({ contentType: "text/plain" }),
        ),
      InvalidWorkbookFileMetadataError,
    );
    assert.equal(workbookRepository.calls.length, 0);
  });
});

class FakeWorkbookRepository
  implements Pick<WorkbookRepository, "createWorkbookIfAbsentByOwnerAndFile">
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
