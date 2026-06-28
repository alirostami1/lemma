import type { DatabasePort } from "@lemma/db";
import { createKyselyOutboxRepository } from "@lemma/events/infrastructure";
import type { WorkbookEngineConfig } from "@lemma/workbook-engine/domain";
import {
  type Clock,
  DraftSourceWorkbookRegistrationService,
  type IdGenerator,
  mapWorkbookFileProviderErrors,
  WorkbookAccessAdapter,
  WorkbookCalculationRequestAdapter,
  WorkbookCalculationService,
  type WorkbookFileProviderPort,
  type WorkbookInternalSnapshotResolverPort,
  WorkbookService,
  type WorkbookSnapshotResolverPort,
} from "./application/index.js";
import { workbookCalculationId } from "./domain/index.js";
import { type RequireIdentity, workbookRoutes } from "./http/index.js";
import {
  createKyselyWorkbookTransaction,
  EngineWorkbookCalculator,
  KyselyWorkbookRepository,
} from "./infrastructure/index.js";

export function createWorkbookModule(deps: {
  db: DatabasePort;
  requireIdentity: RequireIdentity;
  fileProvider: WorkbookFileProviderPort;
  workbookConfig: WorkbookEngineConfig;
  idGenerator: IdGenerator;
  clock: Clock;
}) {
  const workbookRepository = new KyselyWorkbookRepository(deps.db.executor);
  const workbookTransaction = createKyselyWorkbookTransaction(deps.db);
  const workbookFileProvider = mapWorkbookFileProviderErrors(deps.fileProvider);
  const workbookCalculator = new EngineWorkbookCalculator(deps.workbookConfig);

  const serviceDeps = {
    clock: deps.clock,
    idGenerator: deps.idGenerator,
    workbookCalculator,
    workbookEngine: deps.workbookConfig.engine,
    workbookFileProvider,
    workbookRepository,
    workbookTransaction,
  };
  const workbookService = new WorkbookService(serviceDeps);
  const workbookCalculationService = new WorkbookCalculationService(
    serviceDeps,
  );

  const workbookAccessPort = new WorkbookAccessAdapter(workbookService);
  const workbookCalculationPort = new WorkbookCalculationRequestAdapter({
    clock: deps.clock,
    idGenerator: deps.idGenerator,
    workbookRepository,
    workbookTransaction,
  });
  const workbookSnapshotReadPort = {
    listSnapshotMetadataForCalculation: async (input: {
      workbookCalculationId: string;
    }) =>
      workbookRepository.listWorkbookSnapshotMetadataForCalculation(
        workbookCalculationId(input.workbookCalculationId),
      ),
  };
  const workbookSnapshotResolverPort: WorkbookSnapshotResolverPort = {
    resolveValueSource: async (input) =>
      (
        await workbookCalculationService.resolveWorkbookSnapshotValue({
          currentUser: input.currentUser,
          source: input.source,
          workbookSnapshotId: input.workbookSnapshotId,
        })
      ).value,
  };
  const workbookInternalSnapshotResolverPort: WorkbookInternalSnapshotResolverPort =
    {
      resolveValueSource: async (input) =>
        (
          await workbookCalculationService.resolveWorkbookSnapshotValueForInternal(
            {
              source: input.source,
              workbookSnapshotId: input.workbookSnapshotId,
            },
          )
        ).value,
    };

  const routes = workbookRoutes({
    requireIdentity: deps.requireIdentity,
    workbookCalculationService,
    workbookService,
  });

  return {
    createDraftSourceWorkbookRegistrationPortForTransaction(
      tx: DatabasePort["executor"],
    ) {
      return new DraftSourceWorkbookRegistrationService({
        clock: deps.clock,
        eventId: () => deps.idGenerator.eventId(),
        outboxRepository: createKyselyOutboxRepository(tx),
        workbookEngine: deps.workbookConfig.engine,
        workbookId: () => deps.idGenerator.workbookId(),
        workbookRepository: new KyselyWorkbookRepository(tx),
      });
    },
    routes,
    workbookAccessPort,
    workbookCalculationPort,
    workbookCalculationService,
    workbookInternalSnapshotResolverPort,
    workbookService,
    workbookSnapshotReadPort,
    workbookSnapshotResolverPort,
  };
}
