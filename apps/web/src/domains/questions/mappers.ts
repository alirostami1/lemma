import type {
  ListQuestionBlueprintsResponse,
  ListQuestionBlueprintVersionsResponse,
  ListQuestionGenerationRunsResponse,
  ListQuestionSetsResponse,
  ListQuestionsResponse,
  QuestionBlueprintAuthoring as QuestionBlueprintAuthoringDto,
  QuestionBlueprintAuthoringResponse,
  QuestionBlueprint as QuestionBlueprintDto,
  QuestionBlueprintResponse,
  QuestionBlueprintVersion as QuestionBlueprintVersionDto,
  Question as QuestionDto,
  QuestionGenerationRun as QuestionGenerationRunDto,
  QuestionGenerationRunResponse,
  QuestionProducer as QuestionProducerDto,
  QuestionResponse,
  QuestionSet as QuestionSetDto,
  QuestionSetResponse,
  WorkbookSource as WorkbookSourceDto,
} from "#/api/generated/model";
import type {
  Question,
  QuestionBlueprint,
  QuestionBlueprintAuthoring,
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintResult,
  QuestionBlueprintsPage,
  QuestionBlueprintVersion,
  QuestionBlueprintVersionsResult,
  QuestionGenerationRun,
  QuestionGenerationRunResult,
  QuestionGenerationRunsPage,
  QuestionProducer,
  QuestionResult,
  QuestionSet,
  QuestionSetResult,
  QuestionSetsPage,
  QuestionsPage,
  WorkbookQuestionSource,
} from "./model";

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
  const currentVersion = {
    id: dto.currentVersion.id,
    versionNumber: dto.currentVersion.versionNumber,
    sources: dto.currentVersion.sources,
    createdByUserId: dto.currentVersion.createdByUserId,
    createdAt: new Date(dto.currentVersion.createdAt),
  };
  return {
    id: dto.id,
    ownerUserId: dto.ownerUserId,
    createdByUserId: dto.createdByUserId,
    name: dto.name,
    description: dto.description,
    document: dto.document,
    sources: dto.sources,
    currentVersionId: currentVersion.id,
    currentVersionNumber: currentVersion.versionNumber,
    currentVersion,
    visibility: dto.visibility,
    status: dto.status,
    archivedAt: dto.archivedAt ? new Date(dto.archivedAt) : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapQuestionBlueprintAuthoring(
  dto: QuestionBlueprintAuthoringDto,
): QuestionBlueprintAuthoring {
  const currentVersion = mapQuestionBlueprintVersion(dto.currentVersion);
  const selectedVersion = mapQuestionBlueprintVersion(dto.selectedVersion);
  return {
    id: dto.id,
    ownerUserId: dto.ownerUserId,
    createdByUserId: dto.createdByUserId,
    name: dto.name,
    description: dto.description,
    document: dto.document,
    sources: dto.sources,
    currentVersionId: currentVersion.id,
    currentVersionNumber: currentVersion.versionNumber,
    currentVersion,
    selectedVersionId: selectedVersion.id,
    selectedVersionNumber: selectedVersion.versionNumber,
    selectedVersion,
    versions: dto.versions.map(mapQuestionBlueprintVersion),
    visibility: dto.visibility,
    status: dto.status,
    archivedAt: dto.archivedAt ? new Date(dto.archivedAt) : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapQuestion(dto: QuestionDto): Question {
  return {
    ...dto,
    body: dto.body,
    producer: mapQuestionProducer(dto.producer),
    source: dto.source ? mapWorkbookQuestionSource(dto.source) : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapQuestionGenerationRun(
  dto: QuestionGenerationRunDto,
): QuestionGenerationRun {
  return {
    ...dto,
    source: dto.source ? mapWorkbookQuestionSource(dto.source) : null,
    result: dto.result,
    startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
    finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapQuestionSetsResponse(
  response: ListQuestionSetsResponse,
): QuestionSetsPage {
  return {
    questionSets: response.questionSets.map(mapQuestionSet),
    nextCursor: response.nextCursor,
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

export function mapQuestionBlueprintVersionsResponse(
  response: ListQuestionBlueprintVersionsResponse,
): QuestionBlueprintVersionsResult {
  return {
    versions: response.versions.map(mapQuestionBlueprintVersion),
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
    questionBlueprints: response.questionBlueprints.map(mapQuestionBlueprint),
    nextCursor: response.nextCursor,
  };
}

export function mapQuestionsResponse(
  response: ListQuestionsResponse,
): QuestionsPage {
  return {
    questions: response.questions.map(mapQuestion),
    nextCursor: response.nextCursor,
  };
}

export function mapQuestionGenerationRunsResponse(
  response: ListQuestionGenerationRunsResponse,
): QuestionGenerationRunsPage {
  return {
    questionGenerationRuns: response.questionGenerationRuns.map(
      mapQuestionGenerationRun,
    ),
    nextCursor: response.nextCursor,
  };
}

function mapQuestionProducer(dto: QuestionProducerDto): QuestionProducer {
  return {
    ...dto,
    source: dto.source ? { ...dto.source } : undefined,
  };
}

function mapWorkbookQuestionSource(
  dto: WorkbookSourceDto,
): WorkbookQuestionSource {
  return { ...dto };
}

function mapQuestionBlueprintVersion(
  dto: QuestionBlueprintVersionDto,
): QuestionBlueprintVersion {
  return {
    id: dto.id,
    versionNumber: dto.versionNumber,
    sources: dto.sources,
    sourceAssets: dto.sourceAssets.map((asset) => ({
      ...asset,
      createdAt: new Date(asset.createdAt),
    })),
    createdByUserId: dto.createdByUserId,
    createdAt: new Date(dto.createdAt),
  };
}
