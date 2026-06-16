import type { DatabaseExecutor } from "@lemma/db";
import { WorkbookRepositoryFailureError } from "../application/errors.js";
import type { WorkbookRepository } from "../application/ports.js";
import type {
  UserId,
  Workbook,
  WorkbookCalculation,
  WorkbookCalculationStatus,
  WorkbookId,
  WorkbookSnapshot,
  WorkbookStatus,
} from "../domain/index.js";
import { KyselyWorkbookCalculationRepository } from "./KyselyWorkbookCalculationRepository.js";
import { KyselyWorkbookCatalogRepository } from "./KyselyWorkbookCatalogRepository.js";
import { KyselyWorkbookSnapshotRepository } from "./KyselyWorkbookSnapshotRepository.js";

export class KyselyWorkbookRepository implements WorkbookRepository {
  private readonly calculations: KyselyWorkbookCalculationRepository;
  private readonly catalog: KyselyWorkbookCatalogRepository;
  private readonly snapshots: KyselyWorkbookSnapshotRepository;

  constructor(db: DatabaseExecutor) {
    this.calculations = new KyselyWorkbookCalculationRepository(db);
    this.catalog = new KyselyWorkbookCatalogRepository(db);
    this.snapshots = new KyselyWorkbookSnapshotRepository(db);
  }

  listWorkbooksByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly WorkbookStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<Workbook[]> {
    return this.withRepositoryError(() =>
      this.catalog.listWorkbooksByOwnerUserId(input),
    );
  }

  findWorkbookById(id: WorkbookId): Promise<Workbook | null> {
    return this.withRepositoryError(() => this.catalog.findWorkbookById(id));
  }

  createWorkbook(workbook: Workbook): Promise<Workbook> {
    return this.withRepositoryError(() =>
      this.catalog.createWorkbook(workbook),
    );
  }

  updateWorkbook(workbook: Workbook): Promise<Workbook | null> {
    return this.withRepositoryError(() =>
      this.catalog.updateWorkbook(workbook),
    );
  }

  listWorkbookCalculationsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly WorkbookCalculationStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<WorkbookCalculation[]> {
    return this.withRepositoryError(() =>
      this.calculations.listWorkbookCalculationsByOwnerUserId(input),
    );
  }

  listWorkbookCalculationsByWorkbookId(input: {
    workbookId: WorkbookId;
    statuses?: readonly WorkbookCalculationStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<WorkbookCalculation[]> {
    return this.withRepositoryError(() =>
      this.calculations.listWorkbookCalculationsByWorkbookId(input),
    );
  }

  findWorkbookCalculationById(
    id: WorkbookCalculation["id"],
  ): Promise<WorkbookCalculation | null> {
    return this.withRepositoryError(() =>
      this.calculations.findWorkbookCalculationById(id),
    );
  }

  findWorkbookCalculationByCorrelationId(
    correlationId: string,
  ): Promise<WorkbookCalculation | null> {
    return this.withRepositoryError(() =>
      this.calculations.findWorkbookCalculationByCorrelationId(correlationId),
    );
  }

  createWorkbookCalculation(
    calculation: WorkbookCalculation,
  ): Promise<WorkbookCalculation> {
    return this.withRepositoryError(() =>
      this.calculations.createWorkbookCalculation(calculation),
    );
  }

  updateWorkbookCalculation(
    calculation: WorkbookCalculation,
  ): Promise<WorkbookCalculation | null> {
    return this.withRepositoryError(() =>
      this.calculations.updateWorkbookCalculation(calculation),
    );
  }

  claimQueuedWorkbookCalculation(
    id: WorkbookCalculation["id"],
    at: Date,
  ): Promise<WorkbookCalculation | null> {
    return this.withRepositoryError(() =>
      this.calculations.claimQueuedWorkbookCalculation(id, at),
    );
  }

  findWorkbookSnapshotById(
    id: WorkbookSnapshot["id"],
  ): Promise<WorkbookSnapshot | null> {
    return this.withRepositoryError(() =>
      this.snapshots.findWorkbookSnapshotById(id),
    );
  }

  listWorkbookSnapshotsByCalculationId(input: {
    calculationId: WorkbookCalculation["id"];
    limit: number;
    cursor?: number;
  }): Promise<WorkbookSnapshot[]> {
    return this.withRepositoryError(() =>
      this.snapshots.listWorkbookSnapshotsByCalculationId(input),
    );
  }

  createWorkbookSnapshots(
    snapshots: readonly WorkbookSnapshot[],
  ): Promise<WorkbookSnapshot[]> {
    return this.withRepositoryError(() =>
      this.snapshots.createWorkbookSnapshots(snapshots),
    );
  }

  completeWorkbookCalculation(input: {
    calculation: WorkbookCalculation;
    snapshots: readonly WorkbookSnapshot[];
  }): Promise<{
    calculation: WorkbookCalculation;
    snapshots: WorkbookSnapshot[];
  }> {
    return this.withRepositoryError(() =>
      this.calculations.completeWorkbookCalculation(input),
    );
  }

  private async withRepositoryError<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new WorkbookRepositoryFailureError("Workbook repository failed.", {
        cause: error,
      });
    }
  }
}
