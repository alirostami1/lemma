import type {
  DB,
  QuestionBlueprints,
  QuestionBlueprintVersions,
  QuestionGenerationRuns,
  QuestionSets,
  Questions,
} from "@lemma/db/tables";
import type { JsonObject } from "@lemma/domain";
import {
  type Insertable,
  type InsertObject,
  type Selectable,
  sql,
  type Updateable,
  type UpdateObject,
} from "kysely";
import {
  type Question,
  type QuestionBlueprint,
  type QuestionBlueprintVersion,
  type QuestionGenerationRun,
  type QuestionSet,
  reconstituteQuestion,
  reconstituteQuestionBlueprint,
  reconstituteQuestionBlueprintVersion,
  reconstituteQuestionGenerationRun,
  reconstituteQuestionSet,
} from "../domain/index.js";

function toMutableJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

export function mapQuestionSetRowToDomain(
  row: Selectable<QuestionSets>,
): QuestionSet {
  return reconstituteQuestionSet(row);
}

export function mapQuestionSetToInsert(
  set: QuestionSet,
): Insertable<QuestionSets> {
  return {
    archivedAt: set.status === "archived" ? set.updatedAt : null,
    createdAt: set.createdAt,
    createdByUserId: set.createdByUserId,
    description: set.description,
    id: set.id,
    name: set.name,
    ownerUserId: set.ownerUserId,
    status: set.status,
    updatedAt: set.updatedAt,
  };
}

export function mapQuestionSetToUpdate(
  set: QuestionSet,
): Updateable<QuestionSets> {
  return {
    archivedAt: set.status === "archived" ? set.updatedAt : null,
    description: set.description,
    name: set.name,
    status: set.status,
    updatedAt: set.updatedAt,
  };
}

export function mapQuestionBlueprintRowToDomain(
  row: Selectable<QuestionBlueprints> & {
    document: unknown;
    sources: unknown;
  },
): QuestionBlueprint {
  return reconstituteQuestionBlueprint(row);
}

export function mapQuestionBlueprintToInsert(
  blueprint: QuestionBlueprint,
): InsertObject<DB, "questionBlueprints"> {
  return {
    archivedAt: blueprint.archivedAt,
    createdAt: blueprint.createdAt,
    createdByUserId: blueprint.createdByUserId,
    currentVersionId: blueprint.currentVersionId,
    description: blueprint.description,
    document: toMutableJsonObject(blueprint.document),
    id: blueprint.id,
    name: blueprint.name,
    ownerUserId: blueprint.ownerUserId,
    status: blueprint.status,
    updatedAt: blueprint.updatedAt,
    visibility: blueprint.visibility,
  };
}

export function mapQuestionBlueprintToUpdate(
  blueprint: QuestionBlueprint,
): UpdateObject<DB, "questionBlueprints"> {
  return {
    archivedAt: blueprint.archivedAt,
    currentVersionId: blueprint.currentVersionId,
    description: blueprint.description,
    document: toMutableJsonObject(blueprint.document),
    name: blueprint.name,
    status: blueprint.status,
    updatedAt: blueprint.updatedAt,
    visibility: blueprint.visibility,
  };
}

export function mapQuestionBlueprintVersionRowToDomain(
  row: Selectable<QuestionBlueprintVersions> & {
    document: unknown;
    sources: unknown;
  },
): QuestionBlueprintVersion {
  return reconstituteQuestionBlueprintVersion(row);
}

export function mapQuestionBlueprintVersionToInsert(
  version: QuestionBlueprintVersion,
): InsertObject<DB, "questionBlueprintVersions"> {
  return {
    blueprintId: version.blueprintId,
    createdAt: version.createdAt,
    createdByUserId: version.createdByUserId,
    description: version.description,
    document: mapJsonObjectToDb(version.document),
    id: version.id,
    name: version.name,
    ownerUserId: version.ownerUserId,
    parentVersionId: version.parentVersionId,
    publishedAt: version.publishedAt,
    versionNumber: version.versionNumber,
  };
}

export function mapJsonObjectToDb(value: JsonObject) {
  return sql<JsonObject>`${JSON.stringify(value)}::jsonb`;
}

export function mapJsonArrayToDb(value: readonly JsonObject[]) {
  return sql<JsonObject[]>`${JSON.stringify(value)}::jsonb`;
}

export function mapQuestionRowToDomain(
  row: Selectable<Questions> & { sourceEvidence: unknown; sourcePlan: unknown },
): Question {
  return reconstituteQuestion({
    ...row,
    sourceEvidence: row.sourceEvidence,
    sourcePlan: row.sourcePlan,
  });
}

export function mapQuestionToInsert(question: Question): Insertable<Questions> {
  return {
    blueprintId: question.blueprintId,
    body: toMutableJsonObject(question.body),
    createdAt: question.createdAt,
    createdByUserId: question.createdByUserId,
    generationRunId: question.generationRunId,
    id: question.id,
    ownerUserId: question.ownerUserId,
    producer: toMutableJsonObject(question.producer),
    solution: toMutableJsonObject(question.solution),
    sourceEvidence: question.sourceEvidence,
    sourcePlan: toMutableJsonObject(question.sourcePlan),
    status: question.status,
    updatedAt: question.updatedAt,
  } as Insertable<Questions>;
}

export function mapQuestionToUpdate(question: Question): Updateable<Questions> {
  return {
    body: toMutableJsonObject(question.body),
    producer: toMutableJsonObject(question.producer),
    solution: toMutableJsonObject(question.solution),
    sourceEvidence: toMutableJsonObject(question.sourceEvidence),
    sourcePlan: toMutableJsonObject(question.sourcePlan),
    status: question.status,
    updatedAt: question.updatedAt,
  } as Updateable<Questions>;
}

export function mapQuestionGenerationRunRowToDomain(
  row: Selectable<QuestionGenerationRuns> & {
    blueprintSnapshot: unknown;
    workbookCalculationId: string | null;
  },
): QuestionGenerationRun {
  return reconstituteQuestionGenerationRun({
    ...row,
    blueprintSnapshot: row.blueprintSnapshot,
    retryOfRunId: row.retryOfRunId,
  });
}

export function mapQuestionGenerationRunToInsert(
  run: QuestionGenerationRun,
): Insertable<QuestionGenerationRuns> {
  return {
    attemptNumber: run.attemptNumber,
    attempts: run.attempts,
    blueprintId: run.blueprintId,
    blueprintVersionId: run.blueprintVersionId,
    blueprintSnapshot: toMutableJsonObject(run.blueprintSnapshot),
    createdAt: run.createdAt,
    createdByUserId: run.createdByUserId,
    errorMessage: run.errorMessage,
    finishedAt: run.finishedAt,
    id: run.id,
    ownerUserId: run.ownerUserId,
    requestedCount: run.requestedCount,
    result: run.result as JsonObject | null,
    retryOfRunId: run.retryOfRunId,
    startedAt: run.startedAt,
    status: run.status,
    targetQuestionSetId: run.targetQuestionSetId,
    updatedAt: run.updatedAt,
    workbookCalculationId: run.workbookCalculationId,
  };
}

export function mapQuestionGenerationRunToUpdate(
  run: QuestionGenerationRun,
): Updateable<QuestionGenerationRuns> {
  return {
    attemptNumber: run.attemptNumber,
    attempts: run.attempts,
    blueprintSnapshot: toMutableJsonObject(run.blueprintSnapshot),
    errorMessage: run.errorMessage,
    finishedAt: run.finishedAt,
    result: run.result as JsonObject | null,
    retryOfRunId: run.retryOfRunId,
    startedAt: run.startedAt,
    status: run.status,
    updatedAt: run.updatedAt,
    workbookCalculationId: run.workbookCalculationId,
  };
}
