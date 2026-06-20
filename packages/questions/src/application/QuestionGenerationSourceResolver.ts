import type { CurrentUser } from "@lemma/identity/application";
import {
  type QuestionBlueprintVersion,
  type WorkbookQuestionSource,
  workbookId as toWorkbookId,
} from "../domain/index.js";
import { questionBlueprintSourcesReferencedByDocument } from "../domain/index.js";
import {
  ForbiddenQuestionActionError,
  InvalidQuestionBlueprintError,
} from "./errors.js";
import type { WorkbookAccessPort } from "./ports.js";
import { blueprintRequiresWorkbookSource } from "./question-blueprint-analysis.js";

export type GenerationWorkbookSource = WorkbookQuestionSource;

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
    return input.explicitSource;
  }

  assertExplicitSourceIsAllowed(input: {
    version: QuestionBlueprintVersion;
    explicitSource: GenerationWorkbookSource | null;
  }): void {
    if (input.explicitSource === null) {
      return;
    }
    const referencedSources = this.referencedSources(input.version);
    if (
      referencedSources.length > 0 &&
      !referencedSources.some(
        (source) => source.workbookId === input.explicitSource.workbookId,
      )
    ) {
      throw new InvalidQuestionBlueprintError(
        "explicit workbook source must match one of the blueprint's referenced workbook sources",
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

  async assertAccess(input: {
    currentUser: CurrentUser;
    version: QuestionBlueprintVersion;
    source: GenerationWorkbookSource | null;
  }): Promise<void> {
    const workbookIds = new Set(
      this.referencedSources(input.version).map((source) => source.workbookId),
    );
    if (input.source) {
      workbookIds.add(input.source.workbookId);
    }
    for (const workbookId of workbookIds) {
      if (
        !(await this.deps.workbookAccessPort.canUserAccessWorkbook({
          currentUser: input.currentUser,
          workbookId: toWorkbookId(workbookId),
        }))
      ) {
        throw new ForbiddenQuestionActionError(
          "You cannot access this workbook.",
        );
      }
    }
  }

  private referencedSources(version: QuestionBlueprintVersion) {
    return questionBlueprintSourcesReferencedByDocument(
      version.document,
      version.sources,
    );
  }
}
