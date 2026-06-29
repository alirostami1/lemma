import type { OutboxRepository } from "@lemma/events/application";
import type { WorkbookEngineName } from "../domain/index.js";
import { createWorkbookForFile } from "./createWorkbookForFile.js";
import type {
  Clock,
  DraftSourceWorkbookRegistrationCommand,
  DraftSourceWorkbookRegistrationPort,
  DraftSourceWorkbookRegistrationResult,
  IdGenerator,
  WorkbookRepository,
} from "./ports.js";
import { workbookValidationRequestedEvent } from "./workbook-events.js";

type DraftSourceWorkbookRepository = Pick<
  WorkbookRepository,
  "createWorkbookIfAbsentByOwnerAndFile"
>;

export class DraftSourceWorkbookRegistrationService
  implements DraftSourceWorkbookRegistrationPort
{
  constructor(
    private readonly deps: {
      clock: Clock;
      eventId: IdGenerator["eventId"];
      workbookEngine: WorkbookEngineName;
      workbookId: IdGenerator["workbookId"];
      workbookRepository: DraftSourceWorkbookRepository;
      outboxRepository: OutboxRepository;
    },
  ) {}

  async registerWorkbookFromFile(
    input: DraftSourceWorkbookRegistrationCommand,
  ): Promise<DraftSourceWorkbookRegistrationResult> {
    const workbook = createWorkbookForFile({
      at: this.deps.clock.now(),
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256,
      contentType: input.contentType,
      createdByUserId: input.createdByUserId,
      engine: this.deps.workbookEngine,
      fileId: input.fileId,
      id: this.deps.workbookId(),
      name: input.name,
      originalName: input.originalName,
      origin: "source_artifact",
      ownerUserId: input.ownerUserId,
    });

    const persisted =
      await this.deps.workbookRepository.createWorkbookIfAbsentByOwnerAndFile({
        workbook,
      });

    if (persisted.created) {
      await this.deps.outboxRepository.appendEvents([
        workbookValidationRequestedEvent({
          id: this.deps.eventId(),
          lineage: input.lineage,
          occurredAt: persisted.workbook.createdAt,
          workbook: persisted.workbook,
        }),
      ]);
    }

    return {
      status: persisted.workbook.status,
      validationError: persisted.workbook.validationError,
      workbookId: persisted.workbook.id,
    };
  }
}
