import { presentDate, presentNullableDate } from "@lemma/http";
import type {
  CompletedQuestionBlueprintDraftWorkbookEditorUploadResult,
  CreatedQuestionBlueprintDraftWorkbookEditorUploadResult,
  GradeQuestionResult,
  PublishedQuestionBlueprintDraftResult,
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintDraftResult,
  QuestionBlueprintDraftsResult,
  QuestionBlueprintEditDraftResult,
  QuestionBlueprintResult,
  QuestionBlueprintsResult,
  QuestionGenerationRunResultDto,
  QuestionGenerationRunsResult,
  QuestionResult,
  QuestionSetResult,
  QuestionSetsResult,
  QuestionsResult,
  SavedQuestionBlueprintDraftWorkbookSourceRevisionResult,
} from "../application/index.js";
import { questionInputOptions, questionInputValue } from "../domain/index.js";
import type {
  CompleteQuestionBlueprintDraftWorkbookEditorUploadResponse,
  CreateQuestionBlueprintDraftWorkbookEditorUploadResponse,
  GradeQuestionResponse,
  ListQuestionBlueprintDraftsResponse,
  ListQuestionBlueprintsResponse,
  ListQuestionGenerationRunsResponse,
  ListQuestionSetsResponse,
  ListQuestionsResponse,
  PublicQuestionBlueprintInputPrimitive,
  PublicQuestionBlueprintPrimitiveBlock,
  PublishQuestionBlueprintDraftResponse,
  QuestionBlueprintAuthoringResponse,
  QuestionBlueprintDraftResponse,
  QuestionBlueprint as QuestionBlueprintDto,
  QuestionBlueprintEditDraftResponse,
  QuestionBlueprintResponse,
  QuestionBlueprintVersion as QuestionBlueprintVersionDto,
  QuestionGenerationRun as QuestionGenerationRunDto,
  QuestionGenerationRunResponse,
  QuestionResponse,
  QuestionSetResponse,
  SaveQuestionBlueprintDraftWorkbookSourceRevisionResponse,
} from "../generated/types/index.js";

export const presentQuestionBlueprintDraft = (
  result: QuestionBlueprintDraftResult,
): QuestionBlueprintDraftResponse => ({
  draft: {
    baseVersionId: result.draft.baseVersionId,
    blueprintId: result.draft.blueprintId,
    createdAt: presentDate(result.draft.createdAt),
    createdByUserId: result.draft.createdByUserId,
    description: result.draft.description,
    discardedAt: presentNullableDate(result.draft.discardedAt),
    document: result.draft.document,
    id: result.draft.id,
    lastSavedAt: presentDate(result.draft.lastSavedAt),
    name: result.draft.name,
    ownerUserId: result.draft.ownerUserId,
    publishedAt: presentNullableDate(result.draft.publishedAt),
    publishedVersionId: result.draft.publishedVersionId,
    revision: result.draft.revision,
    sources: result.draft.sources.map((source) => ({
      byteSize: source.byteSize,
      checksumSha256: source.checksumSha256,
      fileId: source.fileId,
      name: source.name,
      originalName: source.originalName,
      sourceId: source.sourceId,
      status: source.status,
      type: source.type,
      workbookId: source.workbookId,
    })),
    status: result.draft.status,
    updatedAt: presentDate(result.draft.updatedAt),
  },
});

export const presentSavedQuestionBlueprintDraftWorkbookSourceRevision = (
  result: SavedQuestionBlueprintDraftWorkbookSourceRevisionResult,
): SaveQuestionBlueprintDraftWorkbookSourceRevisionResponse => ({
  ...presentQuestionBlueprintDraft({ draft: result.draft }),
  sourceArtifact: {
    createdAt: presentDate(result.sourceArtifact.createdAt),
    id: result.sourceArtifact.id,
    kind: "workbook",
    processor: result.sourceArtifact.processor,
    processorVersion: result.sourceArtifact.processorVersion,
    sourceRevisionId: result.sourceArtifact.sourceRevisionId,
    status: result.sourceArtifact.status,
    updatedAt: presentDate(result.sourceArtifact.updatedAt),
    validationError: result.sourceArtifact.validationError,
    workbookId: result.sourceArtifact.workbookId,
  },
  sourceRevision: {
    byteSize: result.sourceRevision.byteSize,
    checksumSha256: result.sourceRevision.checksumSha256,
    contentType: result.sourceRevision.contentType,
    createdAt: presentDate(result.sourceRevision.createdAt),
    createdByUserId: result.sourceRevision.createdByUserId,
    id: result.sourceRevision.id,
    kind: "workbook",
    parentRevisionId: result.sourceRevision.parentRevisionId,
    sourceDocumentId: result.sourceRevision.sourceDocumentId,
  },
});

export const presentCreatedQuestionBlueprintDraftWorkbookEditorUpload = (
  result: CreatedQuestionBlueprintDraftWorkbookEditorUploadResult,
): CreateQuestionBlueprintDraftWorkbookEditorUploadResponse => ({
  upload: {
    checksumSha256: result.upload.checksumSha256,
    completedAt: presentNullableDate(result.upload.completedAt),
    contentType: result.upload.contentType,
    createdAt: presentDate(result.upload.createdAt),
    createdByUserId: result.upload.createdByUserId,
    expectedByteSize: result.upload.expectedByteSize,
    id: result.upload.id,
    originalName: result.upload.originalName,
    status: result.upload.status,
    updatedAt: presentDate(result.upload.updatedAt),
    uploadExpiresAt: presentDate(result.upload.uploadExpiresAt),
  },
  uploadUrl: {
    expiresInSeconds: result.uploadUrl.expiresInSeconds,
    headers: result.uploadUrl.headers,
    method: result.uploadUrl.method,
    url: result.uploadUrl.url,
  },
});

export const presentCompletedQuestionBlueprintDraftWorkbookEditorUpload = (
  result: CompletedQuestionBlueprintDraftWorkbookEditorUploadResult,
): CompleteQuestionBlueprintDraftWorkbookEditorUploadResponse => ({
  editorOutputFile: {
    byteSize: result.editorOutputFile.byteSize,
    checksumSha256: result.editorOutputFile.checksumSha256,
    contentType: result.editorOutputFile.contentType,
    id: result.editorOutputFile.id,
    originalName: result.editorOutputFile.originalName,
  },
});

export const presentQuestionBlueprintEditDraft = (
  result: QuestionBlueprintEditDraftResult,
): QuestionBlueprintEditDraftResponse => ({
  ...presentQuestionBlueprintDraft({ draft: result.draft }),
  resolution: result.resolution,
});

export const presentQuestionBlueprintDrafts = (
  result: QuestionBlueprintDraftsResult,
): ListQuestionBlueprintDraftsResponse => ({
  drafts: result.drafts.map(
    (draft) => presentQuestionBlueprintDraft({ draft }).draft,
  ),
  nextCursor: result.nextCursor,
});

export const presentPublishedQuestionBlueprintDraft = (
  result: PublishedQuestionBlueprintDraftResult,
): PublishQuestionBlueprintDraftResponse => ({
  ...presentQuestionBlueprintDraft({ draft: result.draft }),
  ...presentQuestionBlueprint({ questionBlueprint: result.questionBlueprint }),
  questionBlueprintVersion: toQuestionBlueprintVersionDto(
    result.questionBlueprintVersion,
  ),
});

export const presentQuestionSet = (
  result: QuestionSetResult,
): QuestionSetResponse => ({
  questionSet: {
    ...result.questionSet,
    createdAt: presentDate(result.questionSet.createdAt),
    updatedAt: presentDate(result.questionSet.updatedAt),
  },
});

export const presentQuestionSets = (
  result: QuestionSetsResult,
): ListQuestionSetsResponse => ({
  nextCursor: result.nextCursor,
  questionSets: result.questionSets.map(
    (questionSet) => presentQuestionSet({ questionSet }).questionSet,
  ),
});

export const presentQuestionBlueprint = (
  result: QuestionBlueprintResult,
): QuestionBlueprintResponse => ({
  questionBlueprint: {
    ...result.questionBlueprint,
    archivedAt: presentNullableDate(result.questionBlueprint.archivedAt),
    createdAt: presentDate(result.questionBlueprint.createdAt),
    document: toLearnerQuestionBlueprintDocumentDto(
      result.questionBlueprint.document,
    ),
    sources: result.questionBlueprint.sources.map(toQuestionBlueprintSourceDto),
    updatedAt: presentDate(result.questionBlueprint.updatedAt),
  },
});

export const presentQuestionBlueprintAuthoring = (
  result: QuestionBlueprintAuthoringResult,
): QuestionBlueprintAuthoringResponse => ({
  questionBlueprint: {
    ...result.questionBlueprint,
    archivedAt: presentNullableDate(result.questionBlueprint.archivedAt),
    createdAt: presentDate(result.questionBlueprint.createdAt),
    document: result.questionBlueprint.document,
    sources: result.questionBlueprint.sources.map(toQuestionBlueprintSourceDto),
    updatedAt: presentDate(result.questionBlueprint.updatedAt),
  },
});

export const presentQuestionBlueprints = (
  result: QuestionBlueprintsResult,
): ListQuestionBlueprintsResponse => ({
  nextCursor: result.nextCursor,
  questionBlueprints: result.questionBlueprints.map(
    (questionBlueprint) =>
      presentQuestionBlueprint({ questionBlueprint }).questionBlueprint,
  ),
});

export const presentQuestion = (result: QuestionResult): QuestionResponse => {
  const question = result.question;
  return {
    question: {
      blueprintId: question.blueprintId,
      body: question.body,
      createdAt: presentDate(question.createdAt),
      createdByUserId: question.createdByUserId,
      generationRunId: question.generationRunId,
      id: question.id,
      ownerUserId: question.ownerUserId,
      producer: question.producer,
      status: question.status,
      updatedAt: presentDate(question.updatedAt),
    },
  };
};

export const presentQuestions = (
  result: QuestionsResult,
): ListQuestionsResponse => ({
  nextCursor: result.nextCursor,
  questions: result.questions.map(
    (question) => presentQuestion({ question }).question,
  ),
});

export const presentGrade = (
  result: GradeQuestionResult,
): GradeQuestionResponse => result;

export const presentQuestionGenerationRun = (
  result: QuestionGenerationRunResultDto,
): QuestionGenerationRunResponse => ({
  questionGenerationRun: toQuestionGenerationRunDto(result),
});

export const presentQuestionGenerationRuns = (
  result: QuestionGenerationRunsResult,
): ListQuestionGenerationRunsResponse => ({
  nextCursor: result.nextCursor,
  questionGenerationRuns: result.questionGenerationRuns.map(
    (questionGenerationRun) =>
      presentQuestionGenerationRun({ questionGenerationRun })
        .questionGenerationRun,
  ),
});

function toQuestionBlueprintVersionDto(
  version: PublishedQuestionBlueprintDraftResult["questionBlueprintVersion"],
): QuestionBlueprintVersionDto {
  return {
    ...version,
    createdAt: presentDate(version.createdAt),
    document: version.document,
    publishedAt: presentDate(version.publishedAt),
    sources: version.sources.map(toQuestionBlueprintSourceDto),
  };
}

function toQuestionBlueprintSourceDto(
  source:
    | PublishedQuestionBlueprintDraftResult["questionBlueprint"]["sources"][number]
    | PublishedQuestionBlueprintDraftResult["questionBlueprintVersion"]["sources"][number],
) {
  return {
    byteSize: source.byteSize,
    checksumSha256: source.checksumSha256,
    fileId: source.fileId,
    name: source.name,
    originalName: source.originalName,
    sourceId: source.sourceId,
    type: source.type,
    workbookId: source.workbookId,
  };
}

function toLearnerQuestionBlueprintDocumentDto(
  document: QuestionBlueprintResult["questionBlueprint"]["document"],
): QuestionBlueprintDto["document"] {
  return {
    blocks: document.blocks.map(toPublicQuestionBlueprintBlockDto),
    responseFields: document.responseFields,
    schemaVersion: document.schemaVersion,
  };
}

function toPublicQuestionBlueprintBlockDto(
  block: QuestionBlueprintResult["questionBlueprint"]["document"]["blocks"][number],
): QuestionBlueprintDto["document"]["blocks"][number] {
  if (block.kind === "container") {
    return {
      ...block,
      blocks: block.blocks.map(toPublicQuestionBlueprintBlockDto),
    };
  }
  if (block.kind === "complex") {
    return {
      ...block,
      cells: block.cells.map((cell) => ({
        ...cell,
        blocks: cell.blocks.map(toPublicQuestionBlueprintPrimitiveBlockDto),
      })),
    };
  }
  return toPublicQuestionBlueprintPrimitiveBlockDto(block);
}

function toPublicQuestionBlueprintPrimitiveBlockDto(
  block: Extract<
    QuestionBlueprintResult["questionBlueprint"]["document"]["blocks"][number],
    { kind: "primitive" }
  >,
): PublicQuestionBlueprintPrimitiveBlock {
  if (block.type === "text") {
    return {
      ...block,
      content: toPublicInlineContentDto(block.content),
    };
  }
  if (block.type === "input") {
    return {
      id: block.id,
      input: toPublicQuestionBlueprintInputPrimitiveDto(block.input),
      kind: "primitive",
      responseFieldId: block.responseFieldId,
      type: block.type,
      ...(block.label === undefined ? {} : { label: block.label }),
      ...(block.placeholder === undefined
        ? {}
        : { placeholder: block.placeholder }),
    };
  }
  return block;
}

function toPublicQuestionBlueprintInputPrimitiveDto(
  input: Extract<
    QuestionBlueprintResult["questionBlueprint"]["document"]["blocks"][number],
    { kind: "primitive"; type: "input" }
  >["input"],
): PublicQuestionBlueprintInputPrimitive {
  const defaultValueStatus =
    input.defaultValueSource === undefined
      ? "none"
      : input.defaultValueSource.type === "literal"
        ? "literal"
        : "source_backed";
  const optionsStatus =
    input.optionsSource === undefined
      ? "none"
      : input.optionsSource.type === "literal"
        ? "literal"
        : "source_backed";

  return {
    defaultValueStatus,
    optionsStatus,
    schemaVersion: 1,
    type: input.type,
    ...(input.validation?.required === undefined
      ? {}
      : { validation: { required: input.validation.required } }),
    ...(input.defaultValueSource?.type === "literal"
      ? {
          defaultValue: questionInputValue(
            input.defaultValueSource.value,
            input.type,
            "default value",
            impossiblePublicInputFailure,
          ),
        }
      : {}),
    ...(input.optionsSource?.type === "literal"
      ? {
          options: questionInputOptions(
            input.optionsSource.value,
            impossiblePublicInputFailure,
          ),
        }
      : {}),
  };
}

function impossiblePublicInputFailure(message: string): never {
  throw new Error(`invalid persisted input primitive: ${message}`);
}

function toPublicInlineContentDto(
  content: Array<
    | { type: "text"; text: string }
    | {
        type: "reference";
        referenceId: string;
        rangeCell?: { rowOffset: number; columnOffset: number };
        fallbackText?: string;
      }
  >,
) {
  return content.map((part) =>
    part.type === "text"
      ? part
      : { text: part.fallbackText ?? "", type: "text" as const },
  );
}

function toQuestionGenerationRunDto(
  result: QuestionGenerationRunResultDto,
): QuestionGenerationRunDto {
  const run = result.questionGenerationRun;
  return {
    attemptNumber: run.attemptNumber,
    attempts: run.attempts,
    blueprintId: run.blueprintId,
    blueprintVersionId: run.blueprintVersionId,
    createdAt: presentDate(run.createdAt),
    createdByUserId: run.createdByUserId,
    errorMessage: run.errorMessage,
    finishedAt: presentNullableDate(run.finishedAt),
    id: run.id,
    ownerUserId: run.ownerUserId,
    requestedCount: run.requestedCount,
    result: run.result,
    retryOfRunId: run.retryOfRunId,
    startedAt: presentNullableDate(run.startedAt),
    status: run.status,
    targetQuestionSetId: run.targetQuestionSetId,
    updatedAt: presentDate(run.updatedAt),
    workbookCalculationId: run.workbookCalculationId,
  };
}
