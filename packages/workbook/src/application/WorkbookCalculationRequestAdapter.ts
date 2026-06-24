import {
  createInitialWorkbookCalculation,
  type WorkbookCalculation,
} from "../domain/index.js";
import { InvalidWorkbookCalculationRequestError } from "./errors.js";
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
    const idempotent = resolveIdempotentCalculationRequestByCorrelationId({
      correlationId: input.correlationId,
      existing,
    });
    if (idempotent) {
      return idempotent;
    }

    const calculation = createInitialWorkbookCalculation(
      {
        correlationId: input.correlationId ?? null,
        createdByUserId: input.createdByUserId,
        id: this.deps.idGenerator.workbookCalculationId(),
        ownerUserId: input.ownerUserId,
        requestedCount: input.requestedCount,
      },
      this.deps.clock.now(),
    );

    const created = await this.deps.workbookTransaction.transaction(
      async ({ workbookRepository, outboxRepository }) => {
        const persisted =
          await workbookRepository.createWorkbookCalculationWithSources({
            calculation,
            sources,
          });
        await outboxRepository.appendEvents([
          workbookCalculationRequestedEvent({
            calculation: persisted,
            id: this.deps.idGenerator.eventId(),
            lineage: input.lineage,
            occurredAt: persisted.createdAt,
            sources,
          }),
        ]);
        return persisted;
      },
    );

    return { workbookCalculationId: created.id };
  }
}

export function resolveIdempotentCalculationRequestByCorrelationId(input: {
  correlationId: string | null | undefined;
  existing: WorkbookCalculation | null;
}): { workbookCalculationId: WorkbookCalculation["id"] } | null {
  if (!input.existing) {
    return null;
  }
  if (
    input.existing.status === "queued" ||
    input.existing.status === "running" ||
    input.existing.status === "succeeded"
  ) {
    return { workbookCalculationId: input.existing.id };
  }
  throw new InvalidWorkbookCalculationRequestError(
    `Workbook calculation correlationId ${input.correlationId} already belongs to ${input.existing.status} calculation ${input.existing.id}. Create a replacement operation with a new correlationId.`,
  );
}
