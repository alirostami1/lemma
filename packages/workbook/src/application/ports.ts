import type { JsonValue, OperationLineage } from "@lemma/domain";
import type { OutboxRepository } from "@lemma/events/application";
import type { EventId } from "@lemma/events/domain";
import type { CurrentUser } from "@lemma/identity/application";
import type {
  FileId,
  UserId,
  ValueSource,
  Workbook,
  WorkbookCalculation,
  WorkbookCalculationId,
  WorkbookCalculationStatus,
  WorkbookEngineHealth,
  WorkbookId,
  WorkbookInspection,
  WorkbookSnapshot,
  WorkbookSnapshotId,
  WorkbookSparseValues,
  WorkbookStatus,
} from "../domain/index.js";

export interface WorkbookRepository {
  listWorkbooksByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly WorkbookStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<Workbook[]>;
  findWorkbookById(id: WorkbookId): Promise<Workbook | null>;
  createWorkbook(workbook: Workbook): Promise<Workbook>;
  updateWorkbook(workbook: Workbook): Promise<Workbook | null>;
  listWorkbookCalculationsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly WorkbookCalculationStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<WorkbookCalculation[]>;
  listWorkbookCalculationsByWorkbookId(input: {
    workbookId: WorkbookId;
    statuses?: readonly WorkbookCalculationStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<WorkbookCalculation[]>;
  findWorkbookCalculationById(
    id: WorkbookCalculationId,
  ): Promise<WorkbookCalculation | null>;
  findWorkbookCalculationByCorrelationId(
    correlationId: string,
  ): Promise<WorkbookCalculation | null>;
  createWorkbookCalculation(
    calculation: WorkbookCalculation,
  ): Promise<WorkbookCalculation>;
  updateWorkbookCalculation(
    calculation: WorkbookCalculation,
  ): Promise<WorkbookCalculation | null>;
  claimQueuedWorkbookCalculation(
    id: WorkbookCalculationId,
    at: Date,
  ): Promise<WorkbookCalculation | null>;
  findWorkbookSnapshotById(
    id: WorkbookSnapshotId,
  ): Promise<WorkbookSnapshot | null>;
  listWorkbookSnapshotsByCalculationId(input: {
    calculationId: WorkbookCalculationId;
    limit: number;
    cursor?: number;
  }): Promise<WorkbookSnapshot[]>;
  createWorkbookSnapshots(
    snapshots: readonly WorkbookSnapshot[],
  ): Promise<WorkbookSnapshot[]>;
  completeWorkbookCalculation(input: {
    calculation: WorkbookCalculation;
    snapshots: readonly WorkbookSnapshot[];
  }): Promise<{
    calculation: WorkbookCalculation;
    snapshots: WorkbookSnapshot[];
  }>;
}

export type WorkbookFileMetadata = {
  fileId: FileId;
  originalName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
};

export type WorkbookFileContent = WorkbookFileMetadata & {
  bytes: Uint8Array;
};

export type WorkbookFileProviderPort = {
  getWorkbookFileMetadata(input: {
    currentUser: CurrentUser;
    fileId: FileId;
  }): Promise<WorkbookFileMetadata>;
  getWorkbookFileMetadataForOwnerUserId(input: {
    ownerUserId: UserId;
    fileId: FileId;
  }): Promise<WorkbookFileMetadata>;
  readWorkbookFileContent(input: {
    currentUser: CurrentUser;
    fileId: FileId;
  }): Promise<WorkbookFileContent>;
  readWorkbookFileContentForOwnerUserId(input: {
    ownerUserId: UserId;
    fileId: FileId;
  }): Promise<WorkbookFileContent>;
};

export type WorkbookCalculatorOptions = {
  lineage?: OperationLineage | null;
};

export interface WorkbookCalculator {
  inspect(
    path: string,
    options?: WorkbookCalculatorOptions,
  ): Promise<WorkbookInspection>;
  calculate(
    path: string,
    options?: WorkbookCalculatorOptions,
  ): Promise<WorkbookSparseValues>;
  calculateBatch(
    path: string,
    count: number,
    options?: WorkbookCalculatorOptions,
  ): Promise<WorkbookSparseValues[]>;
  health(options?: WorkbookCalculatorOptions): Promise<WorkbookEngineHealth>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  eventId(): EventId;
  workbookId(): WorkbookId;
  workbookCalculationId(): WorkbookCalculationId;
  workbookSnapshotId(): WorkbookSnapshotId;
}

export interface WorkbookTransactionPort {
  transaction<T>(
    fn: (deps: {
      workbookRepository: WorkbookRepository;
      outboxRepository: OutboxRepository;
    }) => Promise<T>,
  ): Promise<T>;
}

export interface WorkbookAccessPort {
  canUserAccessWorkbook(input: {
    currentUser: CurrentUser;
    workbookId: WorkbookId;
  }): Promise<boolean>;
}

export interface WorkbookCalculationPort {
  requestCalculation(input: {
    createdByUserId: UserId;
    workbookId: WorkbookId;
    workbookSources: readonly {
      sourceId: string;
      workbookId: WorkbookId;
    }[];
    requestedCount: number;
    correlationId?: string | null;
    lineage: OperationLineage;
  }): Promise<{ workbookCalculationId: WorkbookCalculationId }>;
}

export interface WorkbookSnapshotResolverPort {
  resolveValueSource(input: {
    currentUser: CurrentUser;
    workbookSnapshotId: WorkbookSnapshotId;
    source: ValueSource;
  }): Promise<JsonValue>;
}

export interface WorkbookInternalSnapshotResolverPort {
  resolveValueSource(input: {
    workbookSnapshotId: WorkbookSnapshotId;
    source: ValueSource;
  }): Promise<JsonValue>;
}
