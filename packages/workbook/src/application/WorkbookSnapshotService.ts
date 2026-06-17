import { instrumentService } from "@lemma/observability";
import {
  resolveWorkbookSnapshotValue,
  workbookCalculationId as toWorkbookCalculationId,
  workbookSnapshotId as toWorkbookSnapshotId,
  type ValueSource,
} from "../domain/index.js";
import type {
  ListWorkbookSnapshotsCommand,
  ResolveWorkbookSnapshotValueCommand,
  WorkbookSnapshotByIdCommand,
} from "./commands.js";
import type {
  WorkbookSnapshotResult,
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
            limit: limit + 1,
            cursor: decodeSnapshotIndexCursor(command.cursor),
          },
        );
      return {
        workbookSnapshots: snapshots.slice(0, limit),
        nextCursor:
          snapshots.length > limit
            ? encodeSnapshotIndexCursor(snapshots[limit - 1]?.snapshotIndex)
            : null,
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
