import type { DatabasePort } from "@lemma/db";
import type { WorkbookEngineConfig } from "@lemma/workbook-engine/domain";
import {
  type Clock,
  type IdGenerator,
  mapWorkbookFileProviderErrors,
  WorkbookAccessAdapter,
  WorkbookCalculationRequestAdapter,
  WorkbookCalculationService,
  type WorkbookFileProviderPort,
  type WorkbookInternalSnapshotResolverPort,
  type WorkbookSnapshotResolverPort,
  WorkbookService,
} from "./application/index.js";
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
    workbookRepository,
    workbookTransaction,
    workbookFileProvider,
    workbookCalculator,
    idGenerator: deps.idGenerator,
    clock: deps.clock,
  };
  const workbookService = new WorkbookService(serviceDeps);
  const workbookCalculationService = new WorkbookCalculationService(
    serviceDeps,
  );

  const workbookAccessPort = new WorkbookAccessAdapter(workbookService);
  const workbookCalculationPort = new WorkbookCalculationRequestAdapter({
    workbookRepository,
    workbookTransaction,
    idGenerator: deps.idGenerator,
    clock: deps.clock,
  });
  const workbookSnapshotResolverPort: WorkbookSnapshotResolverPort = {
    resolveValueSource: async (input) =>
      (
        await workbookCalculationService.resolveWorkbookSnapshotValue({
          currentUser: input.currentUser,
          workbookSnapshotId: input.workbookSnapshotId,
          source: input.source,
        })
      ).value,
  };
  const workbookInternalSnapshotResolverPort:
    WorkbookInternalSnapshotResolverPort = {
      resolveValueSource: async (input) =>
        (
          await workbookCalculationService.resolveWorkbookSnapshotValueForInternal(
            {
              workbookSnapshotId: input.workbookSnapshotId,
              source: input.source,
            },
          )
        ).value,
    };

  const routes = workbookRoutes({
    requireIdentity: deps.requireIdentity,
    workbookService,
    workbookCalculationService,
  });

  return {
    routes,
    workbookService,
    workbookCalculationService,
    workbookAccessPort,
    workbookCalculationPort,
    workbookSnapshotResolverPort,
    workbookInternalSnapshotResolverPort,
  };
}
