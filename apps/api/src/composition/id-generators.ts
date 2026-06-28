import { eventId as toEventId } from "@lemma/events/domain";
import type { IdGenerator as FilesIdGenerator } from "@lemma/files/application";
import {
  fileId as toFileId,
  fileUploadId as toFileUploadId,
} from "@lemma/files/domain";
import type { IdGenerator as IdentityIdGenerator } from "@lemma/identity/application";
import { userId as toIdentityUserId } from "@lemma/identity/domain";
import type { IdGenerator as QuestionsIdGenerator } from "@lemma/questions/application";
import {
  questionBlueprintDraftId as toQuestionBlueprintDraftId,
  questionBlueprintId as toQuestionBlueprintId,
  questionBlueprintVersionId as toQuestionBlueprintVersionId,
  questionGenerationRunId as toQuestionGenerationRunId,
  questionId as toQuestionId,
  questionSetId as toQuestionSetId,
  sourceArtifactId as toSourceArtifactId,
  sourceDocumentId as toSourceDocumentId,
  sourceRevisionId as toSourceRevisionId,
} from "@lemma/questions/domain";
import type { IdGenerator as WorkbookIdGenerator } from "@lemma/workbook/application";
import {
  workbookCalculationId as toWorkbookCalculationId,
  workbookId as toWorkbookId,
  workbookSnapshotId as toWorkbookSnapshotId,
} from "@lemma/workbook/domain";
import { v7 as uuidv7 } from "uuid";

export type ApiIdGenerators = {
  identity: IdentityIdGenerator;
  files: FilesIdGenerator;
  workbook: WorkbookIdGenerator;
  questions: QuestionsIdGenerator;
};

export function createIdGenerators(): ApiIdGenerators {
  return {
    identity: {
      userId: () => toIdentityUserId(uuidv7()),
    },
    files: {
      fileId: () => toFileId(uuidv7()),
      fileUploadId: () => toFileUploadId(uuidv7()),
    },
    workbook: {
      eventId: () => toEventId(uuidv7()),
      workbookId: () => toWorkbookId(uuidv7()),
      workbookCalculationId: () => toWorkbookCalculationId(uuidv7()),
      workbookSnapshotId: () => toWorkbookSnapshotId(uuidv7()),
    },
    questions: {
      questionSetId: () => toQuestionSetId(uuidv7()),
      questionBlueprintId: () => toQuestionBlueprintId(uuidv7()),
      questionBlueprintVersionId: () => toQuestionBlueprintVersionId(uuidv7()),
      questionBlueprintDraftId: () => toQuestionBlueprintDraftId(uuidv7()),
      questionId: () => toQuestionId(uuidv7()),
      questionGenerationRunId: () => toQuestionGenerationRunId(uuidv7()),
      sourceArtifactId: () => toSourceArtifactId(uuidv7()),
      sourceDocumentId: () => toSourceDocumentId(uuidv7()),
      sourceRevisionId: () => toSourceRevisionId(uuidv7()),
      eventId: () => toEventId(uuidv7()),
    },
  };
}
