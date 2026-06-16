import type { WorkbookAccessPort } from "./ports.js";
import type { WorkbookService } from "./WorkbookService.js";

export class WorkbookAccessAdapter implements WorkbookAccessPort {
  constructor(
    private readonly workbookService: Pick<WorkbookService, "getWorkbook">,
  ) {}

  async canUserAccessWorkbook(
    input: Parameters<WorkbookAccessPort["canUserAccessWorkbook"]>[0],
  ): Promise<boolean> {
    try {
      await this.workbookService.getWorkbook({
        currentUser: input.currentUser,
        workbookId: input.workbookId,
      });
      return true;
    } catch {
      return false;
    }
  }
}
