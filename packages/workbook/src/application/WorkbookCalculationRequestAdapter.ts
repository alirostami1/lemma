import {
  assertWorkbookIsUsable,
  createWorkbookCalculation,
} from "../domain/index.js";
import { WorkbookNotFoundError } from "./errors.js";
import type {
  Clock,
  IdGenerator,
  WorkbookCalculationPort,
  WorkbookRepository,
  WorkbookTransactionPort,
} from "./ports.js";
import { normalizeWorkbookCalculationSources } from "./workbook-calculation-sources.js";
import { workbookCalculationRequestedEvent } from "./workbook-events.js";

export class WorkbookCalculationRequestAdapter
  implements WorkbookCalculationPort
{
  constructor(
    private readonly deps: {
      workbookRepository: WorkbookRepository;
      workbookTransaction: WorkbookTransactionPort;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  async requestCalculation(
    input: Parameters<WorkbookCalculationPort["requestCalculation"]>[0],
  ): ReturnType<WorkbookCalculationPort["requestCalculation"]> {
    const sources = normalizeWorkbookCalculationSources(
      input.sources,
      "sources",
    );
    const existing = input.correlationId
      ? await this.deps.workbookRepository.findWorkbookCalculationByCorrelationId(
          input.correlationId,
        )
      : null;
    if (existing) {
      return { workbookCalculationId: existing.id };
    }

    const workbook = await this.deps.workbookRepository.findWorkbookById(
      input.workbookId,
    );
    if (!workbook) {
      throw new WorkbookNotFoundError();
    }
    assertWorkbookIsUsable(workbook);

    const calculation = createWorkbookCalculation(
      {
        id: this.deps.idGenerator.workbookCalculationId(),
        ownerUserId: workbook.ownerUserId,
        createdByUserId: input.createdByUserId,
        workbookId: workbook.id,
        requestedCount: input.requestedCount,
        correlationId: input.correlationId,
      },
      this.deps.clock.now(),
    );

    const created = await this.deps.workbookTransaction.transaction(
      async ({ workbookRepository, outboxRepository }) => {
        const persisted =
          await workbookRepository.createWorkbookCalculation(calculation);
        await outboxRepository.appendEvents([
          workbookCalculationRequestedEvent({
            id: this.deps.idGenerator.eventId(),
            calculation: persisted,
            sources,
            lineage: input.lineage,
            occurredAt: persisted.createdAt,
          }),
        ]);
        return persisted;
      },
    );

    return { workbookCalculationId: created.id };
  }
}
