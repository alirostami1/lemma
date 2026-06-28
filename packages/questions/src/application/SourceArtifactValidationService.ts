import type { UserId, WorkbookId } from "../domain/index.js";
import type {
  QuestionsTransactionPort,
  SourceArtifactValidationResult,
} from "./ports.js";

export class SourceArtifactValidationService {
  constructor(
    private readonly deps: {
      questionsTransaction: QuestionsTransactionPort;
    },
  ) {}

  async applyWorkbookValidationResult(input: {
    workbookId: WorkbookId;
    ownerUserId: UserId;
    status: "valid" | "invalid";
    validationError: string | null;
    occurredAt: Date;
  }): Promise<SourceArtifactValidationResult> {
    return this.deps.questionsTransaction.transaction(
      async ({ questionsRepository }) => {
        const artifacts =
          await questionsRepository.applyWorkbookValidationResultToSourceArtifacts(
            {
              artifactStatus: input.status,
              ownerUserId: input.ownerUserId,
              updatedAt: input.occurredAt,
              validationError: input.validationError,
              workbookId: input.workbookId,
            },
          );
        if (artifacts.length === 0) {
          return {
            finalizedArtifactCount: 0,
            updatedDraftSourceCount: 0,
          };
        }
        // Background workbook validation updates draft source materialization
        // state without bumping user-edit draft revision.
        const updatedDraftSourceCount =
          await questionsRepository.applyWorkbookValidationResultToDraftSources(
            {
              artifactIds: artifacts.map((artifact) => artifact.id),
              draftSourceStatus:
                input.status === "valid" ? "validated" : "invalid",
              ownerUserId: input.ownerUserId,
              updatedAt: input.occurredAt,
              workbookId: input.workbookId,
            },
          );
        return {
          finalizedArtifactCount: artifacts.length,
          updatedDraftSourceCount,
        };
      },
    );
  }
}
