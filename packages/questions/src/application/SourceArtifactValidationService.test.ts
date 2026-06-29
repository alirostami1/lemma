import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type SourceArtifact,
  type SourceArtifactId,
  sourceArtifactId,
  sourceRevisionId,
  type UserId,
  userId,
  type WorkbookId,
  workbookId,
} from "../domain/index.js";
import type { QuestionsRepository } from "./ports.js";
import { SourceArtifactValidationService } from "./SourceArtifactValidationService.js";

const at = new Date("2026-06-26T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df090101");
const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df090102");

describe("SourceArtifactValidationService", () => {
  it("finalizes pending artifacts as valid and updates uploaded draft sources", async () => {
    const repository = new FakeQuestionsRepository([
      createSourceArtifact("019e9315-6a87-715f-9861-8654df090103"),
    ]);
    const service = new SourceArtifactValidationService({
      questionsTransaction: {
        transaction: (fn) =>
          fn({
            // Focused repository fake: implements only source-artifact
            // validation methods exercised by this service path.
            questionsRepository: repository as unknown as QuestionsRepository,
          }),
      },
    });

    const result = await service.applyWorkbookValidationResult({
      occurredAt: at,
      ownerUserId,
      status: "valid",
      validationError: null,
      workbookId: sourceWorkbookId,
    });

    assert.deepEqual(result, {
      finalizedArtifactCount: 1,
      updatedDraftSourceCount: 1,
    });

    assert.deepEqual(repository.artifactFinalizationCalls, [
      {
        artifactStatus: "valid",
        ownerUserId,
        updatedAt: at,
        validationError: null,
        workbookId: sourceWorkbookId,
      },
    ]);
    assert.deepEqual(repository.draftFinalizationCalls, [
      {
        artifactIds: [sourceArtifactId("019e9315-6a87-715f-9861-8654df090103")],
        draftSourceStatus: "validated",
        ownerUserId,
        updatedAt: at,
        workbookId: sourceWorkbookId,
      },
    ]);
  });

  it("is idempotent when no pending artifacts remain", async () => {
    const repository = new FakeQuestionsRepository([]);
    const service = new SourceArtifactValidationService({
      questionsTransaction: {
        transaction: (fn) =>
          fn({
            // Focused repository fake: implements only source-artifact
            // validation methods exercised by this idempotency path.
            questionsRepository: repository as unknown as QuestionsRepository,
          }),
      },
    });

    const result = await service.applyWorkbookValidationResult({
      occurredAt: at,
      ownerUserId,
      status: "invalid",
      validationError: "bad workbook",
      workbookId: sourceWorkbookId,
    });

    assert.deepEqual(result, {
      finalizedArtifactCount: 0,
      updatedDraftSourceCount: 0,
    });
    assert.equal(repository.artifactFinalizationCalls.length, 1);
    assert.equal(repository.draftFinalizationCalls.length, 0);
  });
});

class FakeQuestionsRepository {
  readonly artifactFinalizationCalls: Array<{
    artifactStatus: "valid" | "invalid";
    ownerUserId: UserId;
    updatedAt: Date;
    validationError: string | null;
    workbookId: WorkbookId;
  }> = [];
  readonly draftFinalizationCalls: Array<{
    artifactIds: readonly SourceArtifactId[];
    draftSourceStatus: "validated" | "invalid";
    ownerUserId: UserId;
    updatedAt: Date;
    workbookId: WorkbookId;
  }> = [];

  constructor(private readonly artifacts: readonly SourceArtifact[]) {}

  async applyWorkbookValidationResultToDraftSources(input: {
    artifactIds: readonly SourceArtifactId[];
    draftSourceStatus: "validated" | "invalid";
    ownerUserId: UserId;
    updatedAt: Date;
    workbookId: WorkbookId;
  }): Promise<number> {
    this.draftFinalizationCalls.push(input);
    return input.artifactIds.length;
  }

  async applyWorkbookValidationResultToSourceArtifacts(input: {
    artifactStatus: "valid" | "invalid";
    ownerUserId: UserId;
    updatedAt: Date;
    validationError: string | null;
    workbookId: WorkbookId;
  }): Promise<readonly SourceArtifact[]> {
    this.artifactFinalizationCalls.push(input);
    return this.artifacts;
  }
}

function createSourceArtifact(id: string): SourceArtifact {
  return {
    artifactMetadata: {},
    collectedAt: null,
    createdAt: at,
    deletedAt: null,
    id: sourceArtifactId(id),
    kind: "workbook",
    ownerUserId,
    processor: "workbook-registration",
    processorVersion: "1",
    retentionExpiresAt: null,
    sourceRevisionId: sourceRevisionId("019e9315-6a87-715f-9861-8654df090104"),
    status: "pending_validation",
    updatedAt: at,
    validationError: null,
    workbookId: sourceWorkbookId,
  };
}
