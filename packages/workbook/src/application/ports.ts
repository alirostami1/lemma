import type { JsonValue, OperationLineage } from "@lemma/domain";
import type { OutboxRepository } from "@lemma/events/application";
import type { EventId } from "@lemma/events/domain";
import type { FileReferenceGuardPort } from "@lemma/files/application";
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
import type { WorkbookCalculationSource } from "./workbook-calculation-sources.js";

export type { FileReferenceGuardPort } from "@lemma/files/application";

export type WorkbookCalculationSourceRecord = WorkbookCalculationSource & {
  calculationId: WorkbookCalculationId;
  position: number;
  createdAt: Date;
};

export type WorkbookSnapshotGenerationMetadata = {
  id: WorkbookSnapshotId;
  calculationId: WorkbookCalculationId;
  sourceId: string;
  workbookId: WorkbookId;
  questionIndex: number;
  snapshotIndex: number;
};

export interface WorkbookRepository {
  claimQueuedWorkbookCalculation(
    id: WorkbookCalculationId,
    at: Date,
  ): Promise<WorkbookCalculation | null>;
  completeWorkbookCalculation(input: {
    calculation: WorkbookCalculation;
    snapshots: readonly WorkbookSnapshot[];
  }): Promise<{
    calculation: WorkbookCalculation;
    snapshots: WorkbookSnapshot[];
  }>;
  createWorkbook(workbook: Workbook): Promise<Workbook>;
  createWorkbookCalculationWithSources(input: {
    calculation: WorkbookCalculation;
    sources: readonly WorkbookCalculationSource[];
  }): Promise<WorkbookCalculation>;
  createWorkbookIfAbsentByOwnerAndFile(input: { workbook: Workbook }): Promise<{
    workbook: Workbook;
    created: boolean;
  }>;
  createWorkbookSnapshots(
    snapshots: readonly WorkbookSnapshot[],
  ): Promise<WorkbookSnapshot[]>;
  findWorkbookById(id: WorkbookId): Promise<Workbook | null>;
  findWorkbookByOwnerUserIdAndFileId(input: {
    ownerUserId: UserId;
    fileId: FileId;
  }): Promise<Workbook | null>;
  findWorkbookByOwnerUserIdAndFileIdForUpdate(input: {
    ownerUserId: UserId;
    fileId: FileId;
  }): Promise<Workbook | null>;
  findWorkbookCalculationByCorrelationId(
    correlationId: string,
  ): Promise<WorkbookCalculation | null>;
  findWorkbookCalculationById(
    id: WorkbookCalculationId,
  ): Promise<WorkbookCalculation | null>;
  findWorkbookSnapshotById(
    id: WorkbookSnapshotId,
  ): Promise<WorkbookSnapshot | null>;
  listWorkbookCalculationSources(
    calculationId: WorkbookCalculationId,
  ): Promise<WorkbookCalculationSourceRecord[]>;
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
  listWorkbookSnapshotMetadataForCalculation(
    calculationId: WorkbookCalculationId,
  ): Promise<readonly WorkbookSnapshotGenerationMetadata[]>;
  listWorkbookSnapshotsByCalculationId(input: {
    calculationId: WorkbookCalculationId;
    limit: number;
    cursor?: number;
  }): Promise<WorkbookSnapshot[]>;
  listWorkbooksByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly WorkbookStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<Workbook[]>;
  promoteWorkbookToStandalone(workbook: Workbook): Promise<Workbook | null>;
  updateWorkbook(workbook: Workbook): Promise<Workbook | null>;
  updateWorkbookCalculation(
    calculation: WorkbookCalculation,
  ): Promise<WorkbookCalculation | null>;
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
  inspect(
    path: string,
    options?: WorkbookCalculatorOptions,
  ): Promise<WorkbookInspection>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  eventId(): EventId;
  workbookCalculationId(): WorkbookCalculationId;
  workbookId(): WorkbookId;
  workbookSnapshotId(): WorkbookSnapshotId;
}

export interface WorkbookTransactionPort {
  transaction<T>(
    fn: (deps: {
      fileReferenceGuard: FileReferenceGuardPort;
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
    ownerUserId: UserId;
    createdByUserId: UserId;
    requestedCount: number;
    correlationId?: string | null;
    lineage: OperationLineage;
    sources: readonly WorkbookCalculationSource[];
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

export type DraftSourceWorkbookRegistrationCommand = {
  ownerUserId: UserId;
  createdByUserId: UserId;
  fileId: string;
  name: string;
  byteSize: number;
  contentType: string;
  checksumSha256: string;
  originalName: string;
  lineage: OperationLineage;
};

export type DraftSourceWorkbookRegistrationResult = {
  workbookId: WorkbookId;
  status: WorkbookStatus;
  validationError: string | null;
};

export interface DraftSourceWorkbookRegistrationPort {
  registerWorkbookFromFile(
    input: DraftSourceWorkbookRegistrationCommand,
  ): Promise<DraftSourceWorkbookRegistrationResult>;
}
