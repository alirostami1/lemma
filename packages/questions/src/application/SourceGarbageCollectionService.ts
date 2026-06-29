import type { SourceGarbageCollectionEligibility } from "../domain/index.js";
import {
  evaluateSourceGarbageCollection,
  markSourceArtifactCollected,
  SOURCE_LIFECYCLE_RETENTION_DEFAULTS,
  sourceArtifactId,
  sourceDocumentId,
  tombstoneSourceDocument,
  userId,
} from "../domain/index.js";
import type { Clock, QuestionsTransactionPort } from "./ports.js";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export class SourceGarbageCollectionService {
  constructor(
    private readonly deps: {
      clock: Clock;
      questionsTransaction: QuestionsTransactionPort;
    },
  ) {}

  tombstoneSourceDocument(input: {
    ownerUserId: string;
    sourceDocumentId: string;
  }): Promise<"not_found" | "tombstoned"> {
    return this.deps.questionsTransaction.transaction(
      async ({ questionsRepository }) => {
        const document =
          await questionsRepository.findSourceDocumentByIdForUpdate(
            sourceDocumentId(input.sourceDocumentId),
          );
        if (!document || document.ownerUserId !== userId(input.ownerUserId)) {
          return "not_found";
        }
        if (document.status === "deleted") return "tombstoned";
        const deletedAt = this.deps.clock.now();
        const retentionExpiresAt = new Date(
          deletedAt.getTime() +
            SOURCE_LIFECYCLE_RETENTION_DEFAULTS.deletedSourceDocumentDays *
              DAY_IN_MILLISECONDS,
        );
        const persisted =
          await questionsRepository.tombstoneSourceDocumentGraph({
            document: tombstoneSourceDocument(
              document,
              deletedAt,
              retentionExpiresAt,
            ),
          });
        return persisted ? "tombstoned" : "not_found";
      },
    );
  }

  collectSourceArtifact(input: {
    sourceArtifactId: string;
  }): Promise<SourceArtifactCollectionResult> {
    return this.deps.questionsTransaction.transaction(
      async ({ questionsRepository }) => {
        const artifact =
          await questionsRepository.findSourceArtifactByIdForUpdate(
            sourceArtifactId(input.sourceArtifactId),
          );
        if (!artifact) return { status: "not_found" };
        const protectedReferences =
          await questionsRepository.countProtectedSourceArtifactReferences(
            artifact.id,
          );
        const eligibility = evaluateSourceGarbageCollection({
          collectedAt: artifact.collectedAt,
          deletedAt: artifact.deletedAt,
          now: this.deps.clock.now(),
          protectedReferences,
          retentionExpiresAt: artifact.retentionExpiresAt,
        });
        if (!eligibility.eligible) return { eligibility, status: "skipped" };
        const backingWorkbook = artifact.workbookId
          ? await questionsRepository.findSourceArtifactBackingWorkbookForUpdate(
              {
                sourceArtifactId: artifact.id,
                workbookId: artifact.workbookId,
              },
            )
          : null;
        const retireBackingWorkbook =
          backingWorkbook?.origin === "source_artifact" &&
          backingWorkbook.otherUncollectedSourceArtifacts === 0;
        const collected =
          await questionsRepository.updateSourceArtifactForCollection({
            artifact: markSourceArtifactCollected(
              artifact,
              this.deps.clock.now(),
            ),
            retireBackingWorkbook,
          });
        if (collected) return { status: "collected" };
        const current = await questionsRepository.findSourceArtifactById(
          artifact.id,
        );
        if (!current) return { status: "not_found" };
        const currentProtectedReferences =
          await questionsRepository.countProtectedSourceArtifactReferences(
            current.id,
          );
        const currentEligibility = evaluateSourceGarbageCollection({
          collectedAt: current.collectedAt,
          deletedAt: current.deletedAt,
          now: this.deps.clock.now(),
          protectedReferences: currentProtectedReferences,
          retentionExpiresAt: current.retentionExpiresAt,
        });
        if (currentEligibility.eligible) {
          return { reason: "collection_conflict", status: "retry" };
        }
        return { eligibility: currentEligibility, status: "skipped" };
      },
    );
  }
}

export type SourceArtifactCollectionResult =
  | { status: "collected" | "not_found" }
  | { status: "retry"; reason: "collection_conflict" }
  | { status: "skipped"; eligibility: SourceGarbageCollectionEligibility };
