import type { CurrentUser } from "@lemma/identity/application";
import type {
  QuestionBlueprintDocument,
  QuestionBlueprintSource,
} from "../domain/index.js";
import {
  questionBlueprintSourcesReferencedByDocument,
  workbookId as toWorkbookId,
} from "../domain/index.js";
import { ForbiddenQuestionActionError } from "./errors.js";
import type { WorkbookAccessPort } from "./ports.js";

export class QuestionGenerationSourceResolver {
  constructor(
    private readonly deps: {
      workbookAccessPort: WorkbookAccessPort;
    },
  ) {}

  async assertAccess(input: {
    currentUser: CurrentUser;
    document: QuestionBlueprintDocument;
    sources: readonly QuestionBlueprintSource[];
  }): Promise<void> {
    const usedSources = questionBlueprintSourcesReferencedByDocument(
      input.document,
      input.sources,
    );

    for (const source of usedSources) {
      if (
        !(await this.deps.workbookAccessPort.canUserAccessWorkbook({
          currentUser: input.currentUser,
          workbookId: toWorkbookId(source.workbookId),
        }))
      ) {
        throw new ForbiddenQuestionActionError(
          "You cannot access this workbook.",
        );
      }
    }
  }
}
