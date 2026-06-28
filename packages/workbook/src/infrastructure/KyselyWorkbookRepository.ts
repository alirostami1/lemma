import type { DatabaseExecutor } from "@lemma/db";
import {
  WorkbookRepositoryDataError,
  WorkbookRepositoryFailureError,
} from "../application/errors.js";
import type {
  WorkbookCalculationSourceRecord,
  WorkbookRepository,
  WorkbookSnapshotGenerationMetadata,
} from "../application/ports.js";
import type {
  FileId,
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

  findWorkbookByOwnerUserIdAndFileId(input: {
    ownerUserId: UserId;
    fileId: FileId;
  }): Promise<Workbook | null> {
    return this.withRepositoryError(() =>
      this.catalog.findWorkbookByOwnerUserIdAndFileId(input),
    );
  }

  createWorkbook(workbook: Workbook): Promise<Workbook> {
    return this.withRepositoryError(() =>
      this.catalog.createWorkbook(workbook),
    );
  }

  createWorkbookIfAbsentByOwnerAndFile(input: { workbook: Workbook }): Promise<{
    workbook: Workbook;
    created: boolean;
  }> {
    return this.withRepositoryError(() =>
      this.catalog.createWorkbookIfAbsentByOwnerAndFile(input),
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

  createWorkbookCalculationWithSources(input: {
    calculation: WorkbookCalculation;
    sources: readonly { sourceId: string; workbookId: string }[];
  }): Promise<WorkbookCalculation> {
    return this.withRepositoryError(() =>
      this.calculations.createWorkbookCalculationWithSources(input),
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

  listWorkbookSnapshotMetadataForCalculation(
    calculationId: WorkbookCalculation["id"],
  ): Promise<readonly WorkbookSnapshotGenerationMetadata[]> {
    return this.withRepositoryError(() =>
      this.snapshots.listWorkbookSnapshotMetadataForCalculation(calculationId),
    );
  }

  listWorkbookCalculationSources(
    calculationId: WorkbookCalculation["id"],
  ): Promise<WorkbookCalculationSourceRecord[]> {
    return this.withRepositoryError(() =>
      this.calculations.listWorkbookCalculationSources(calculationId),
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
      if (error instanceof WorkbookRepositoryDataError) {
        throw error;
      }
      throw new WorkbookRepositoryFailureError("Workbook repository failed.", {
        cause: error,
      });
    }
  }
}
