import type {
  QuestionBlueprints,
  QuestionBlueprintVersionAssets,
  QuestionBlueprintVersions,
  QuestionGenerationRuns,
  QuestionSets,
  Questions,
} from "@lemma/db/tables";
import type { JsonObject } from "@lemma/domain";
import type { Insertable, Selectable, Updateable } from "kysely";
import {
  type Question,
  type QuestionBlueprint,
  type QuestionBlueprintVersion,
  type QuestionBlueprintVersionAsset,
  type QuestionGenerationRun,
  type QuestionSet,
  reconstituteQuestion,
  reconstituteQuestionBlueprint,
  reconstituteQuestionBlueprintVersion,
  reconstituteQuestionBlueprintVersionAsset,
  reconstituteQuestionGenerationRun,
  reconstituteQuestionSet,
} from "../domain/index.js";

export function mapQuestionSetRowToDomain(
  row: Selectable<QuestionSets>,
): QuestionSet {
  return reconstituteQuestionSet(row);
}

export function mapQuestionSetToInsert(
  set: QuestionSet,
): Insertable<QuestionSets> {
  return {
    id: set.id,
    ownerUserId: set.ownerUserId,
    createdByUserId: set.createdByUserId,
    name: set.name,
    description: set.description,
    status: set.status,
    archivedAt: set.status === "archived" ? set.updatedAt : null,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
  };
}

export function mapQuestionSetToUpdate(
  set: QuestionSet,
): Updateable<QuestionSets> {
  return {
    name: set.name,
    description: set.description,
    status: set.status,
    archivedAt: set.status === "archived" ? set.updatedAt : null,
    updatedAt: set.updatedAt,
  };
}

export function mapQuestionBlueprintRowToDomain(
  row: Selectable<QuestionBlueprints>,
): QuestionBlueprint {
  return reconstituteQuestionBlueprint(row);
}

export function mapQuestionBlueprintVersionRowToDomain(
  row: Selectable<QuestionBlueprintVersions>,
): QuestionBlueprintVersion {
  return reconstituteQuestionBlueprintVersion(row);
}

export function mapQuestionBlueprintVersionAssetRowToDomain(
  row: Selectable<QuestionBlueprintVersionAssets>,
): QuestionBlueprintVersionAsset {
  return reconstituteQuestionBlueprintVersionAsset(row);
}

export function mapQuestionBlueprintToInsert(
  blueprint: QuestionBlueprint,
): Insertable<QuestionBlueprints> {
  return {
    id: blueprint.id,
    ownerUserId: blueprint.ownerUserId,
    createdByUserId: blueprint.createdByUserId,
    name: blueprint.name,
    description: blueprint.description,
    visibility: blueprint.visibility,
    status: blueprint.status,
    createdAt: blueprint.createdAt,
    updatedAt: blueprint.updatedAt,
    workbookId: blueprint.workbookId,
    workbookSources: blueprint.workbookSources as unknown as JsonObject[],
    currentVersionId: blueprint.currentVersionId,
    archivedAt: blueprint.archivedAt,
  } as Insertable<QuestionBlueprints>;
}

export function mapQuestionBlueprintToUpdate(
  blueprint: QuestionBlueprint,
): Updateable<QuestionBlueprints> {
  return {
    name: blueprint.name,
    description: blueprint.description,
    visibility: blueprint.visibility,
    status: blueprint.status,
    updatedAt: blueprint.updatedAt,
    archivedAt: blueprint.archivedAt,
    workbookSources: blueprint.workbookSources as unknown as JsonObject[],
  } as Updateable<QuestionBlueprints>;
}

export function mapQuestionBlueprintVersionToInsert(
  version: QuestionBlueprintVersion,
): Insertable<QuestionBlueprintVersions> {
  return {
    id: version.id,
    questionBlueprintId: version.questionBlueprintId,
    versionNumber: version.versionNumber,
    document: version.document as JsonObject,
    workbookId: version.workbookId,
    workbookSources: version.workbookSources as unknown as JsonObject[],
    createdByUserId: version.createdByUserId,
    createdAt: version.createdAt,
  } as Insertable<QuestionBlueprintVersions>;
}

export function mapQuestionBlueprintVersionAssetToInsert(
  asset: QuestionBlueprintVersionAsset,
): Insertable<QuestionBlueprintVersionAssets> {
  return {
    questionBlueprintVersionId: asset.questionBlueprintVersionId,
    workbookId: asset.workbookId,
    kind: asset.kind,
    position: asset.position,
    createdAt: asset.createdAt,
  };
}

export function mapQuestionRowToDomain(row: Selectable<Questions>): Question {
  return reconstituteQuestion({
    ...row,
    blueprintId: row.blueprintId,
    blueprintVersionId: row.blueprintVersionId,
  });
}

export function mapQuestionToInsert(question: Question): Insertable<Questions> {
  return {
    id: question.id,
    ownerUserId: question.ownerUserId,
    createdByUserId: question.createdByUserId,
    blueprintId: question.blueprintId,
    blueprintVersionId: question.blueprintVersionId,
    generationRunId: question.generationRunId,
    body: question.body as JsonObject,
    solution: question.solution as JsonObject | null,
    sourcePlan: question.sourcePlan as JsonObject | null,
    producer: question.producer as JsonObject | null,
    source: question.source as JsonObject | null,
    status: question.status,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  } as Insertable<Questions>;
}

export function mapQuestionToUpdate(question: Question): Updateable<Questions> {
  return {
    body: question.body as JsonObject,
    solution: question.solution as JsonObject,
    sourcePlan: question.sourcePlan as JsonObject,
    producer: question.producer as JsonObject,
    source: question.source as JsonObject | null,
    status: question.status,
    updatedAt: question.updatedAt,
  } as Updateable<Questions>;
}

export function mapQuestionGenerationRunRowToDomain(
  row: Selectable<QuestionGenerationRuns>,
): QuestionGenerationRun {
  return reconstituteQuestionGenerationRun({
    ...row,
    blueprintId: row.blueprintId,
    blueprintVersionId: row.blueprintVersionId,
    source: row.source,
    result: row.result,
  });
}

export function mapQuestionGenerationRunToInsert(
  run: QuestionGenerationRun,
): Insertable<QuestionGenerationRuns> {
  return {
    id: run.id,
    ownerUserId: run.ownerUserId,
    createdByUserId: run.createdByUserId,
    blueprintId: run.blueprintId,
    blueprintVersionId: run.blueprintVersionId,
    targetQuestionSetId: run.targetQuestionSetId,
    requestedCount: run.requestedCount,
    source: run.source as JsonObject | null,
    status: run.status,
    result: run.result as JsonObject | null,
    errorMessage: run.errorMessage,
    attempts: run.attempts,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

export function mapQuestionGenerationRunToUpdate(
  run: QuestionGenerationRun,
): Updateable<QuestionGenerationRuns> {
  return {
    source: run.source as JsonObject | null,
    status: run.status,
    result: run.result as JsonObject | null,
    errorMessage: run.errorMessage,
    attempts: run.attempts,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    updatedAt: run.updatedAt,
  };
}
