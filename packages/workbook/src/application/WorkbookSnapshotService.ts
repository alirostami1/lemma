import { instrumentService } from "@lemma/observability";
import {
  createWorkbookSnapshotCells,
  createWorkbookSnapshotMetadata,
  createWorkbookSnapshotRange,
  createWorkbookSnapshotRangeBatch,
  listWorkbookSnapshotSheets,
  resolveWorkbookSnapshotValue,
  workbookCalculationId as toWorkbookCalculationId,
  workbookSnapshotId as toWorkbookSnapshotId,
  type ValueSource,
} from "../domain/index.js";
import type {
  ListWorkbookSnapshotSheetsCommand,
  ListWorkbookSnapshotsCommand,
  ResolveWorkbookSnapshotValueCommand,
  WorkbookSnapshotByIdCommand,
  WorkbookSnapshotCellsCommand,
  WorkbookSnapshotMetadataCommand,
  WorkbookSnapshotRangeBatchCommand,
  WorkbookSnapshotRangeCommand,
} from "./commands.js";
import type {
  WorkbookSnapshotCellsResult,
  WorkbookSnapshotMetadataResult,
  WorkbookSnapshotRangeBatchResult,
  WorkbookSnapshotRangeResult,
  WorkbookSnapshotResult,
  WorkbookSnapshotSheetsResult,
  WorkbookSnapshotsResult,
  WorkbookSnapshotValueResult,
} from "./dto.js";
import {
  ForbiddenWorkbookActionError,
  WorkbookCalculationNotFoundError,
  WorkbookSnapshotNotFoundError,
} from "./errors.js";
import {
  decodeSnapshotIndexCursor,
  encodeSnapshotIndexCursor,
  normalizeListLimit,
} from "./mappers.js";
import {
  canViewWorkbookCalculation,
  canViewWorkbookSnapshot,
} from "./policies.js";
import type { WorkbookRepository } from "./ports.js";

const instrumentation = instrumentService("workbook", "snapshot_service");

export class WorkbookSnapshotService {
  constructor(
    private readonly deps: {
      workbookRepository: WorkbookRepository;
    },
  ) {}

  async listWorkbookSnapshots(
    command: ListWorkbookSnapshotsCommand,
  ): Promise<WorkbookSnapshotsResult> {
    return this.operation("list_workbook_snapshots", async () => {
      const calculation = await this.findCalculationByIdOrThrow(
        command.workbookCalculationId,
      );
      this.assertAuthorized(
        canViewWorkbookCalculation(command.currentUser, calculation),
        "You cannot view this workbook calculation.",
      );
      const limit = normalizeListLimit(command.limit);
      const snapshots =
        await this.deps.workbookRepository.listWorkbookSnapshotsByCalculationId(
          {
            calculationId: calculation.id,
            cursor: decodeSnapshotIndexCursor(command.cursor),
            limit: limit + 1,
          },
        );
      return {
        nextCursor:
          snapshots.length > limit
            ? encodeSnapshotIndexCursor(snapshots[limit - 1]?.snapshotIndex)
            : null,
        workbookSnapshots: snapshots.slice(0, limit),
      };
    });
  }

  async getWorkbookSnapshot(
    command: WorkbookSnapshotByIdCommand,
  ): Promise<WorkbookSnapshotResult> {
    return this.operation("get_workbook_snapshot", async () => {
      const snapshot = await this.findSnapshotByIdOrThrow(
        command.workbookSnapshotId,
      );
      const calculation =
        await this.deps.workbookRepository.findWorkbookCalculationById(
          snapshot.calculationId,
        );
      this.assertAuthorized(
        canViewWorkbookSnapshot(command.currentUser, snapshot, calculation),
        "You cannot view this workbook snapshot.",
      );
      return { workbookSnapshot: snapshot };
    });
  }

  async getWorkbookSnapshotMetadata(
    command: WorkbookSnapshotMetadataCommand,
  ): Promise<WorkbookSnapshotMetadataResult> {
    return this.operation("get_workbook_snapshot_metadata", async () => {
      const snapshot = (await this.getWorkbookSnapshot(command))
        .workbookSnapshot;
      return {
        workbookSnapshotMetadata: createWorkbookSnapshotMetadata(snapshot),
      };
    });
  }

  async listWorkbookSnapshotSheets(
    command: ListWorkbookSnapshotSheetsCommand,
  ): Promise<WorkbookSnapshotSheetsResult> {
    return this.operation("list_workbook_snapshot_sheets", async () => {
      const snapshot = (await this.getWorkbookSnapshot(command))
        .workbookSnapshot;
      return listWorkbookSnapshotSheets(snapshot, {
        cursor: command.cursor,
        limit: command.limit,
      });
    });
  }

  async getWorkbookSnapshotCells(
    command: WorkbookSnapshotCellsCommand,
  ): Promise<WorkbookSnapshotCellsResult> {
    return this.operation("get_workbook_snapshot_cells", async () => {
      const snapshot = (await this.getWorkbookSnapshot(command))
        .workbookSnapshot;
      return {
        workbookSnapshotCells: createWorkbookSnapshotCells(snapshot, {
          columnCount: command.columnCount,
          rowCount: command.rowCount,
          sheetIndex: command.sheetIndex,
          startColumn: command.startColumn,
          startRow: command.startRow,
        }),
      };
    });
  }

  async getWorkbookSnapshotRange(
    command: WorkbookSnapshotRangeCommand,
  ): Promise<WorkbookSnapshotRangeResult> {
    return this.operation("get_workbook_snapshot_range", async () => {
      const snapshot = (await this.getWorkbookSnapshot(command))
        .workbookSnapshot;
      return {
        workbookSnapshotRange: createWorkbookSnapshotRange(snapshot, {
          ref: command.ref,
        }),
      };
    });
  }

  async getWorkbookSnapshotRangeBatch(
    command: WorkbookSnapshotRangeBatchCommand,
  ): Promise<WorkbookSnapshotRangeBatchResult> {
    return this.operation("get_workbook_snapshot_range_batch", async () => {
      const snapshot = (await this.getWorkbookSnapshot(command))
        .workbookSnapshot;
      return {
        workbookSnapshotRangeBatch: createWorkbookSnapshotRangeBatch(snapshot, {
          refs: command.refs,
        }),
      };
    });
  }

  async resolveWorkbookSnapshotValue(
    command: ResolveWorkbookSnapshotValueCommand,
  ): Promise<WorkbookSnapshotValueResult> {
    return this.operation("resolve_workbook_snapshot_value", async () => {
      const snapshot = (await this.getWorkbookSnapshot(command))
        .workbookSnapshot;
      return {
        value: resolveWorkbookSnapshotValue(
          snapshot,
          command.source as ValueSource,
        ),
      };
    });
  }

  async resolveWorkbookSnapshotValueForInternal(
    command: Omit<ResolveWorkbookSnapshotValueCommand, "currentUser">,
  ): Promise<WorkbookSnapshotValueResult> {
    return this.operation(
      "resolve_workbook_snapshot_value_internal",
      async () => {
        const snapshot = await this.findSnapshotByIdOrThrow(
          command.workbookSnapshotId,
        );
        return {
          value: resolveWorkbookSnapshotValue(
            snapshot,
            command.source as ValueSource,
          ),
        };
      },
    );
  }

  private async findCalculationByIdOrThrow(workbookCalculationId: string) {
    const calculation =
      await this.deps.workbookRepository.findWorkbookCalculationById(
        toWorkbookCalculationId(workbookCalculationId),
      );
    if (!calculation) {
      throw new WorkbookCalculationNotFoundError();
    }
    return calculation;
  }

  private async findSnapshotByIdOrThrow(workbookSnapshotId: string) {
    const snapshot =
      await this.deps.workbookRepository.findWorkbookSnapshotById(
        toWorkbookSnapshotId(workbookSnapshotId),
      );
    if (!snapshot) {
      throw new WorkbookSnapshotNotFoundError();
    }
    return snapshot;
  }

  private assertAuthorized(value: boolean, message: string): void {
    if (!value) {
      throw new ForbiddenWorkbookActionError(message);
    }
  }

  private async operation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, fn);
  }
}
