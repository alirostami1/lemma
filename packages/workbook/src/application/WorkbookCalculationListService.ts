import {
  workbookCalculationStatus,
  workbookId as toWorkbookId,
} from "../domain/index.js";
import type { ListWorkbookCalculationsCommand } from "./commands.js";
import type { WorkbookCalculationsResult } from "./dto.js";
import {
  ForbiddenWorkbookActionError,
  WorkbookNotFoundError,
} from "./errors.js";
import {
  decodeListCursor,
  encodeListCursor,
  normalizeListLimit,
} from "./mappers.js";
import { canRequestWorkbookCalculation } from "./policies.js";
import type { WorkbookRepository } from "./ports.js";

export class WorkbookCalculationListService {
  constructor(
    private readonly deps: {
      workbookRepository: WorkbookRepository;
    },
  ) {}

  async listWorkbookCalculations(
    command: ListWorkbookCalculationsCommand,
  ): Promise<WorkbookCalculationsResult> {
    const limit = normalizeListLimit(command.limit);
    const statuses = command.status
      ? [workbookCalculationStatus(command.status)]
      : undefined;
    const workbookId = command.workbookId
      ? toWorkbookId(command.workbookId)
      : undefined;
    if (workbookId) {
      const workbook =
        await this.deps.workbookRepository.findWorkbookById(workbookId);
      if (!workbook) {
        throw new WorkbookNotFoundError();
      }
      this.assertAuthorized(
        canRequestWorkbookCalculation(command.currentUser, workbook),
        "You cannot view workbook calculations.",
      );
      const calculations =
        await this.deps.workbookRepository.listWorkbookCalculationsByWorkbookId(
          {
            workbookId,
            statuses,
            limit: limit + 1,
            cursor: decodeListCursor(command.cursor),
          },
        );
      return {
        workbookCalculations: calculations.slice(0, limit),
        nextCursor:
          calculations.length > limit
            ? encodeListCursor(calculations[limit - 1]?.createdAt)
            : null,
      };
    }
    const calculations =
      await this.deps.workbookRepository.listWorkbookCalculationsByOwnerUserId({
        ownerUserId: command.currentUser.user.id,
        statuses,
        limit: limit + 1,
        cursor: decodeListCursor(command.cursor),
      });
    return {
      workbookCalculations: calculations.slice(0, limit),
      nextCursor:
        calculations.length > limit
          ? encodeListCursor(calculations[limit - 1]?.createdAt)
          : null,
    };
  }

  private assertAuthorized(value: boolean, message: string): void {
    if (!value) {
      throw new ForbiddenWorkbookActionError(message);
    }
  }
}
