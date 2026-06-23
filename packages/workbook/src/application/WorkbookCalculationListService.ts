import {
  workbookId as toWorkbookId,
  workbookCalculationStatus,
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
    input: ListWorkbookCalculationsCommand,
  ): Promise<WorkbookCalculationsResult> {
    const limit = normalizeListLimit(input.limit);
    const statuses = input.status
      ? [workbookCalculationStatus(input.status)]
      : undefined;
    const workbookId = input.workbookId
      ? toWorkbookId(input.workbookId)
      : undefined;
    if (workbookId) {
      const workbook =
        await this.deps.workbookRepository.findWorkbookById(workbookId);
      if (!workbook) {
        throw new WorkbookNotFoundError();
      }
      this.assertAuthorized(
        canRequestWorkbookCalculation(input.currentUser, workbook),
        "You cannot view workbook calculations.",
      );
      const calculations =
        await this.deps.workbookRepository.listWorkbookCalculationsByWorkbookId(
          {
            cursor: decodeListCursor(input.cursor),
            limit: limit + 1,
            statuses,
            workbookId,
          },
        );
      return {
        nextCursor:
          calculations.length > limit
            ? encodeListCursor(calculations[limit - 1]?.createdAt)
            : null,
        workbookCalculations: calculations.slice(0, limit),
      };
    }
    const calculations =
      await this.deps.workbookRepository.listWorkbookCalculationsByOwnerUserId({
        cursor: decodeListCursor(input.cursor),
        limit: limit + 1,
        ownerUserId: input.currentUser.user.id,
        statuses,
      });
    return {
      nextCursor:
        calculations.length > limit
          ? encodeListCursor(calculations[limit - 1]?.createdAt)
          : null,
      workbookCalculations: calculations.slice(0, limit),
    };
  }

  private assertAuthorized(value: boolean, message: string): void {
    if (!value) {
      throw new ForbiddenWorkbookActionError(message);
    }
  }
}
