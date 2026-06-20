import {
  InvalidQuestionFieldError,
  type QuestionBlueprint,
  type QuestionBlueprintVersion,
  type QuestionBlueprintWorkbookSource,
  type QuestionSet,
  questionBlueprintDocument,
  questionBlueprintWorkbookSources,
  questionBlueprintId as toQuestionBlueprintId,
  questionId as toQuestionId,
  questionSetId as toQuestionSetId,
  workbookSourceIdsUsedByDocument,
} from "../domain/index.js";
import type {
  HydratedQuestionBlueprint,
  HydratedQuestionBlueprintVersion,
} from "./dto.js";
import {
  ForbiddenQuestionActionError,
  QuestionBlueprintNotFoundError,
  QuestionNotFoundError,
  QuestionSetNotFoundError,
} from "./errors.js";
import type { QuestionsRepository } from "./ports.js";

export function assertQuestionAuthorized(
  allowed: boolean,
  message: string,
): void {
  if (!allowed) {
    throw new ForbiddenQuestionActionError(message);
  }
}

export async function findQuestionSetByIdOrThrow(
  questionsRepository: QuestionsRepository,
  id: string,
) {
  const questionSet = await questionsRepository.findQuestionSetById(
    toQuestionSetId(id),
  );
  if (!questionSet) {
    throw new QuestionSetNotFoundError();
  }
  return questionSet;
}

export async function findQuestionBlueprintByIdOrThrow(
  questionsRepository: QuestionsRepository,
  id: string,
) {
  const blueprint = await questionsRepository.findQuestionBlueprintById(
    toQuestionBlueprintId(id),
  );
  if (!blueprint) {
    throw new QuestionBlueprintNotFoundError();
  }
  return blueprint;
}

export async function findQuestionByIdOrThrow(
  questionsRepository: QuestionsRepository,
  id: string,
) {
  const question = await questionsRepository.findQuestionById(toQuestionId(id));
  if (!question) {
    throw new QuestionNotFoundError();
  }
  return question;
}

export async function persistQuestionSet(
  questionsRepository: QuestionsRepository,
  questionSet: QuestionSet,
) {
  const updated = await questionsRepository.updateQuestionSet(questionSet);
  if (!updated) {
    throw new QuestionSetNotFoundError();
  }
  return updated;
}

export async function persistQuestionBlueprint(
  questionsRepository: QuestionsRepository,
  blueprint: QuestionBlueprint,
) {
  const updated = await questionsRepository.updateQuestionBlueprint(blueprint);
  if (!updated) {
    throw new QuestionBlueprintNotFoundError();
  }
  return updated;
}

export async function hydrateQuestionBlueprint(
  questionsRepository: QuestionsRepository,
  blueprint: QuestionBlueprint,
): Promise<HydratedQuestionBlueprint> {
  if (blueprint.currentVersionId === null) {
    throw new QuestionBlueprintNotFoundError(
      "question blueprint has no current version",
    );
  }
  const currentVersion =
    await questionsRepository.findQuestionBlueprintVersionById(
      blueprint.currentVersionId,
    );
  if (!currentVersion) {
    throw new QuestionBlueprintNotFoundError();
  }
  const hydratedVersion = await hydrateQuestionBlueprintVersion(
    questionsRepository,
    currentVersion,
  );
  return {
    ...blueprint,
    currentVersion: hydratedVersion,
  };
}

export async function hydrateQuestionBlueprintVersion(
  questionsRepository: QuestionsRepository,
  version: QuestionBlueprintVersion,
): Promise<HydratedQuestionBlueprintVersion> {
  const sourceAssets =
    await questionsRepository.listQuestionBlueprintVersionAssets({
      blueprintVersionId: version.id,
    });
  return {
    ...version,
    sourceAssets,
  };
}

export async function hydrateQuestionBlueprintVersions(
  questionsRepository: QuestionsRepository,
  versions: QuestionBlueprintVersion[],
): Promise<HydratedQuestionBlueprintVersion[]> {
  const assets =
    await questionsRepository.listQuestionBlueprintVersionAssetsByVersionIds({
      blueprintVersionIds: versions.map((version) => version.id),
    });
  const assetsByVersionId = new Map<
    string,
    HydratedQuestionBlueprintVersion["sourceAssets"]
  >();
  for (const asset of assets) {
    const current = assetsByVersionId.get(asset.questionBlueprintVersionId);
    if (current) {
      current.push(asset);
    } else {
      assetsByVersionId.set(asset.questionBlueprintVersionId, [asset]);
    }
  }
  return versions.map((version) => ({
    ...version,
    sourceAssets: assetsByVersionId.get(version.id) ?? [],
  }));
}

export function normalizeCanonicalBlueprintInput(input: {
  document: unknown;
  workbookSources: unknown;
}) {
  const document = questionBlueprintDocument(input.document);
  const workbookSources = normalizeWorkbookSources({
    document,
    workbookSources: input.workbookSources,
  });
  return {
    document,
    workbookId: workbookSources[0]?.workbookId ?? null,
    workbookSources,
  };
}

function normalizeWorkbookSources(input: {
  document: ReturnType<typeof questionBlueprintDocument>;
  workbookSources: unknown;
}): QuestionBlueprintWorkbookSource[] {
  const usedSourceIds = workbookSourceIdsUsedByDocument(input.document);
  if (usedSourceIds.size === 0) {
    return [];
  }

  const sources = questionBlueprintWorkbookSources(input.workbookSources);
  const sourcesById = new Map(
    sources.map((source) => [source.sourceId, source]),
  );
  const usedSources: QuestionBlueprintWorkbookSource[] = [];
  for (const sourceId of usedSourceIds) {
    const source = sourcesById.get(sourceId);
    if (!source) {
      throw new InvalidQuestionFieldError(
        `workbook reference source ${sourceId} is not attached to this blueprint`,
      );
    }
    usedSources.push(source);
  }
  return usedSources;
}
