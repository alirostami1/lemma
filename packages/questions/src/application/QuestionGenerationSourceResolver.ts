import type { CurrentUser } from "@lemma/identity/application";
import {
  type QuestionBlueprintVersion,
  workbookId as toWorkbookId,
  workbookQuestionSource,
} from "../domain/index.js";
import {
  ForbiddenQuestionActionError,
  InvalidQuestionBlueprintError,
} from "./errors.js";
import type { WorkbookAccessPort } from "./ports.js";
import { blueprintRequiresWorkbookSource } from "./question-blueprint-analysis.js";

export type GenerationWorkbookSource = ReturnType<
  typeof workbookQuestionSource
>;

export class QuestionGenerationSourceResolver {
  constructor(
    private readonly deps: {
      workbookAccessPort: WorkbookAccessPort;
    },
  ) {}

  resolve(input: {
    version: QuestionBlueprintVersion;
    explicitSource: GenerationWorkbookSource | null;
  }): GenerationWorkbookSource | null {
    if (input.explicitSource !== null) {
      return input.explicitSource;
    }

    const workbookId =
      input.version.workbookSources[0]?.workbookId ?? input.version.workbookId;
    return workbookId
      ? workbookQuestionSource({
          type: "workbook_snapshot",
          workbookId,
        })
      : null;
  }

  assertExplicitSourceIsAllowed(input: {
    version: QuestionBlueprintVersion;
    explicitSource: GenerationWorkbookSource | null;
  }): void {
    if (input.explicitSource === null) {
      return;
    }
    const allowedWorkbookIds = new Set(
      input.version.workbookSources.length > 0
        ? input.version.workbookSources.map((source) => source.workbookId)
        : input.version.workbookId
          ? [input.version.workbookId]
          : [],
    );
    if (!allowedWorkbookIds.has(input.explicitSource.workbookId)) {
      throw new InvalidQuestionBlueprintError(
        "explicit workbook source must match a blueprint workbook source",
      );
    }
  }

  assertRequiredSourcePresent(input: {
    version: QuestionBlueprintVersion;
    source: GenerationWorkbookSource | null;
  }): void {
    if (
      blueprintRequiresWorkbookSource(input.version.document) &&
      !input.source
    ) {
      throw new InvalidQuestionBlueprintError(
        "blueprint requires workbook source",
      );
    }
  }

  async assertAccess(
    currentUser: CurrentUser,
    source: GenerationWorkbookSource | null,
  ): Promise<void> {
    if (
      source &&
      !(await this.deps.workbookAccessPort.canUserAccessWorkbook({
        currentUser,
        workbookId: toWorkbookId(source.workbookId),
      }))
    ) {
      throw new ForbiddenQuestionActionError(
        "You cannot access this workbook.",
      );
    }
  }
}
