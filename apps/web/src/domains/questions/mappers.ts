import type {
  CompleteQuestionBlueprintDraftWorkbookEditorUploadResponse,
  CreateQuestionBlueprintDraftWorkbookEditorUploadResponse,
  ListQuestionBlueprintDraftsResponse,
  ListQuestionBlueprintsResponse,
  ListQuestionGenerationRunsResponse,
  ListQuestionSetsResponse,
  ListQuestionsResponse,
  PublishQuestionBlueprintDraftResponse,
  QuestionBlueprintAuthoring as QuestionBlueprintAuthoringDto,
  QuestionBlueprintAuthoringResponse,
  QuestionBlueprintDraft as QuestionBlueprintDraftDto,
  QuestionBlueprintDraftResponse,
  QuestionBlueprint as QuestionBlueprintDto,
  QuestionBlueprintEditDraftResponse,
  QuestionBlueprintResponse,
  QuestionBlueprintVersion as QuestionBlueprintVersionDto,
  Question as QuestionDto,
  QuestionGenerationRun as QuestionGenerationRunDto,
  QuestionGenerationRunResponse,
  QuestionProducer as QuestionProducerDto,
  QuestionResponse,
  QuestionSet as QuestionSetDto,
  QuestionSetResponse,
  SaveQuestionBlueprintDraftWorkbookSourceRevisionResponse,
} from "#/api/generated/model";
import type {
  CompleteQuestionBlueprintDraftWorkbookEditorUploadResult,
  CreateQuestionBlueprintDraftWorkbookEditorUploadResult,
  PublishQuestionBlueprintDraftResult,
  Question,
  QuestionBlueprint,
  QuestionBlueprintAuthoring,
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintDraft,
  QuestionBlueprintDraftResult,
  QuestionBlueprintDraftSummariesPage,
  QuestionBlueprintDraftSummary,
  QuestionBlueprintDraftsPage,
  QuestionBlueprintEditDraftResult,
  QuestionBlueprintResult,
  QuestionBlueprintsPage,
  QuestionBlueprintVersion,
  QuestionGenerationRun,
  QuestionGenerationRunResult,
  QuestionGenerationRunsPage,
  QuestionProducer,
  QuestionResult,
  QuestionSet,
  QuestionSetResult,
  QuestionSetsPage,
  QuestionsPage,
  SaveQuestionBlueprintDraftWorkbookSourceRevisionResult,
} from "./model";

export function mapQuestionBlueprintDraft(
  dto: QuestionBlueprintDraftDto,
): QuestionBlueprintDraft {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    discardedAt: dto.discardedAt ? new Date(dto.discardedAt) : null,
    lastSavedAt: new Date(dto.lastSavedAt),
    publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapQuestionBlueprintDraftResponse(
  response: QuestionBlueprintDraftResponse,
): QuestionBlueprintDraftResult {
  return { draft: mapQuestionBlueprintDraft(response.draft) };
}

export function mapSaveQuestionBlueprintDraftWorkbookSourceRevisionResponse(
  response: SaveQuestionBlueprintDraftWorkbookSourceRevisionResponse,
): SaveQuestionBlueprintDraftWorkbookSourceRevisionResult {
  return {
    draft: mapQuestionBlueprintDraft(response.draft),
    sourceArtifact: {
      ...response.sourceArtifact,
      createdAt: new Date(response.sourceArtifact.createdAt),
      updatedAt: new Date(response.sourceArtifact.updatedAt),
    },
    sourceRevision: {
      ...response.sourceRevision,
      createdAt: new Date(response.sourceRevision.createdAt),
    },
  };
}

export function mapCreateQuestionBlueprintDraftWorkbookEditorUploadResponse(
  response: CreateQuestionBlueprintDraftWorkbookEditorUploadResponse,
): CreateQuestionBlueprintDraftWorkbookEditorUploadResult {
  return {
    upload: {
      ...response.upload,
      completedAt: response.upload.completedAt
        ? new Date(response.upload.completedAt)
        : null,
      createdAt: new Date(response.upload.createdAt),
      updatedAt: new Date(response.upload.updatedAt),
      uploadExpiresAt: new Date(response.upload.uploadExpiresAt),
    },
    uploadUrl: response.uploadUrl,
  };
}

export function mapCompleteQuestionBlueprintDraftWorkbookEditorUploadResponse(
  response: CompleteQuestionBlueprintDraftWorkbookEditorUploadResponse,
): CompleteQuestionBlueprintDraftWorkbookEditorUploadResult {
  return {
    editorOutputFile: response.editorOutputFile,
  };
}

export function mapQuestionBlueprintEditDraftResponse(
  response: QuestionBlueprintEditDraftResponse,
): QuestionBlueprintEditDraftResult {
  return {
    draft: mapQuestionBlueprintDraft(response.draft),
    resolution: response.resolution,
  };
}

export function mapQuestionBlueprintDraftSummary(
  dto: QuestionBlueprintDraftDto,
): QuestionBlueprintDraftSummary {
  return {
    blueprintId: dto.blueprintId,
    description: dto.description,
    id: dto.id,
    lastSavedAt: new Date(dto.lastSavedAt),
    name: dto.name,
    sourceCount: dto.sources.length,
    status: dto.status,
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapQuestionBlueprintDraftSummariesResponse(
  response: ListQuestionBlueprintDraftsResponse,
): QuestionBlueprintDraftSummariesPage {
  return {
    drafts: response.drafts.map(mapQuestionBlueprintDraftSummary),
    nextCursor: response.nextCursor,
  };
}

export function mapQuestionBlueprintDraftsResponse(
  response: ListQuestionBlueprintDraftsResponse,
): QuestionBlueprintDraftsPage {
  return {
    drafts: response.drafts.map(mapQuestionBlueprintDraft),
    nextCursor: response.nextCursor,
  };
}

export function mapPublishQuestionBlueprintDraftResponse(
  response: PublishQuestionBlueprintDraftResponse,
): PublishQuestionBlueprintDraftResult {
  return {
    draft: mapQuestionBlueprintDraft(response.draft),
    questionBlueprint: mapQuestionBlueprint(response.questionBlueprint),
    questionBlueprintVersion: mapQuestionBlueprintVersion(
      response.questionBlueprintVersion,
    ),
  };
}

export function mapQuestionSet(dto: QuestionSetDto): QuestionSet {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapQuestionBlueprint(
  dto: QuestionBlueprintDto,
): QuestionBlueprint {
  return {
    archivedAt: dto.archivedAt ? new Date(dto.archivedAt) : null,
    createdAt: new Date(dto.createdAt),
    createdByUserId: dto.createdByUserId,
    currentVersionId: dto.currentVersionId,
    description: dto.description,
    document: dto.document,
    id: dto.id,
    name: dto.name,
    ownerUserId: dto.ownerUserId,
    sources: dto.sources,
    status: dto.status,
    updatedAt: new Date(dto.updatedAt),
    visibility: dto.visibility,
  };
}

export function mapQuestionBlueprintAuthoring(
  dto: QuestionBlueprintAuthoringDto,
): QuestionBlueprintAuthoring {
  return {
    archivedAt: dto.archivedAt ? new Date(dto.archivedAt) : null,
    createdAt: new Date(dto.createdAt),
    createdByUserId: dto.createdByUserId,
    currentVersionId: dto.currentVersionId,
    description: dto.description,
    document: dto.document,
    id: dto.id,
    name: dto.name,
    ownerUserId: dto.ownerUserId,
    sources: dto.sources,
    status: dto.status,
    updatedAt: new Date(dto.updatedAt),
    visibility: dto.visibility,
  };
}

export function mapQuestionBlueprintVersion(
  dto: QuestionBlueprintVersionDto,
): QuestionBlueprintVersion {
  return {
    blueprintId: dto.blueprintId,
    createdAt: new Date(dto.createdAt),
    createdByUserId: dto.createdByUserId,
    description: dto.description,
    document: dto.document,
    id: dto.id,
    name: dto.name,
    ownerUserId: dto.ownerUserId,
    parentVersionId: dto.parentVersionId,
    publishedAt: new Date(dto.publishedAt),
    sources: dto.sources,
    versionNumber: dto.versionNumber,
  };
}

export function mapQuestion(dto: QuestionDto): Question {
  return {
    blueprintId: dto.blueprintId,
    body: dto.body,
    createdAt: new Date(dto.createdAt),
    createdByUserId: dto.createdByUserId,
    generationRunId: dto.generationRunId,
    id: dto.id,
    ownerUserId: dto.ownerUserId,
    producer: mapQuestionProducer(dto.producer),
    status: dto.status,
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapQuestionGenerationRun(
  dto: QuestionGenerationRunDto,
): QuestionGenerationRun {
  return {
    attemptNumber: dto.attemptNumber,
    attempts: dto.attempts,
    blueprintId: dto.blueprintId,
    blueprintVersionId: dto.blueprintVersionId,
    createdAt: new Date(dto.createdAt),
    createdByUserId: dto.createdByUserId,
    errorMessage: dto.errorMessage,
    finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : null,
    id: dto.id,
    ownerUserId: dto.ownerUserId,
    requestedCount: dto.requestedCount,
    result: dto.result,
    retryOfRunId: dto.retryOfRunId,
    startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
    status: dto.status,
    targetQuestionSetId: dto.targetQuestionSetId,
    updatedAt: new Date(dto.updatedAt),
    workbookCalculationId: dto.workbookCalculationId,
  };
}

export function mapQuestionSetsResponse(
  response: ListQuestionSetsResponse,
): QuestionSetsPage {
  return {
    nextCursor: response.nextCursor,
    questionSets: response.questionSets.map(mapQuestionSet),
  };
}

export function mapQuestionSetResponse(
  response: QuestionSetResponse,
): QuestionSetResult {
  return { questionSet: mapQuestionSet(response.questionSet) };
}

export function mapQuestionResponse(
  response: QuestionResponse,
): QuestionResult {
  return { question: mapQuestion(response.question) };
}

export function mapQuestionBlueprintResponse(
  response: QuestionBlueprintResponse,
): QuestionBlueprintResult {
  return {
    questionBlueprint: mapQuestionBlueprint(response.questionBlueprint),
  };
}

export function mapQuestionBlueprintAuthoringResponse(
  response: QuestionBlueprintAuthoringResponse,
): QuestionBlueprintAuthoringResult {
  return {
    questionBlueprint: mapQuestionBlueprintAuthoring(
      response.questionBlueprint,
    ),
  };
}

export function mapQuestionGenerationRunResponse(
  response: QuestionGenerationRunResponse,
): QuestionGenerationRunResult {
  return {
    questionGenerationRun: mapQuestionGenerationRun(
      response.questionGenerationRun,
    ),
  };
}

export function mapQuestionBlueprintsResponse(
  response: ListQuestionBlueprintsResponse,
): QuestionBlueprintsPage {
  return {
    nextCursor: response.nextCursor,
    questionBlueprints: response.questionBlueprints.map(mapQuestionBlueprint),
  };
}

export function mapQuestionsResponse(
  response: ListQuestionsResponse,
): QuestionsPage {
  return {
    nextCursor: response.nextCursor,
    questions: response.questions.map(mapQuestion),
  };
}

export function mapQuestionGenerationRunsResponse(
  response: ListQuestionGenerationRunsResponse,
): QuestionGenerationRunsPage {
  return {
    nextCursor: response.nextCursor,
    questionGenerationRuns: response.questionGenerationRuns.map(
      mapQuestionGenerationRun,
    ),
  };
}

function mapQuestionProducer(dto: QuestionProducerDto): QuestionProducer {
  return {
    ...dto,
    source: dto.source ? { ...dto.source } : undefined,
  };
}
