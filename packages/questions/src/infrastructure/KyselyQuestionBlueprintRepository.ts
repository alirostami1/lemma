import type { DatabaseExecutor } from "@lemma/db";
import type {
  QuestionBlueprint,
  QuestionBlueprintId,
  QuestionBlueprintStatus,
  QuestionBlueprintVersion,
  QuestionBlueprintVersionId,
  UserId,
} from "../domain/index.js";
import {
  createQuestionBlueprintVersion,
  questionBlueprintVersionId,
  questionBlueprintVersionNumber,
} from "../domain/index.js";
import {
  mapQuestionBlueprintRowToDomain,
  mapQuestionBlueprintToInsert,
  mapQuestionBlueprintToUpdate,
  mapQuestionBlueprintVersionRowToDomain,
  mapQuestionBlueprintVersionToInsert,
} from "./KyselyQuestionMappers.js";

export class KyselyQuestionBlueprintRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async findQuestionBlueprintById(
    id: QuestionBlueprintId,
  ): Promise<QuestionBlueprint | null> {
    const row = await this.baseBlueprintQuery()
      .where("questionBlueprints.id", "=", id)
      .executeTakeFirst();
    return row ? mapQuestionBlueprintRowToDomain(row) : null;
  }

  async findQuestionBlueprintVersionById(
    id: QuestionBlueprintVersionId,
  ): Promise<QuestionBlueprintVersion | null> {
    const row = await this.db
      .selectFrom("questionBlueprintVersions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapQuestionBlueprintVersionRowToDomain(row) : null;
  }

  async listQuestionBlueprintsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly QuestionBlueprintStatus[];
    limit: number;
    cursor?: Date;
    includeSystem?: boolean;
  }): Promise<QuestionBlueprint[]> {
    let query = this.baseBlueprintQuery();
    query = input.includeSystem
      ? query.where((eb) =>
          eb.or([
            eb("questionBlueprints.ownerUserId", "=", input.ownerUserId),
            eb("questionBlueprints.visibility", "=", "system"),
          ]),
        )
      : query.where("questionBlueprints.ownerUserId", "=", input.ownerUserId);

    if (input.statuses?.length) {
      query = query.where("questionBlueprints.status", "in", input.statuses);
    }
    if (input.cursor) {
      query = query.where("questionBlueprints.createdAt", "<", input.cursor);
    }

    const rows = await query
      .orderBy("questionBlueprints.createdAt", "desc")
      .limit(input.limit)
      .execute();
    return rows.map((row) => mapQuestionBlueprintRowToDomain(row));
  }

  async createQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint> {
    return withTransaction(this.db, (tx) =>
      createQuestionBlueprintInTransaction(tx, blueprint),
    );
  }

  async updateQuestionBlueprint(
    blueprint: QuestionBlueprint,
  ): Promise<QuestionBlueprint | null> {
    const row = await this.db
      .updateTable("questionBlueprints")
      .set(mapQuestionBlueprintToUpdate(blueprint))
      .where("id", "=", blueprint.id)
      .returningAll()
      .executeTakeFirst();
    return row ? mapQuestionBlueprintRowToDomain(row) : null;
  }

  async updateQuestionBlueprintDefinition(input: {
    blueprint: QuestionBlueprint;
    versionId: QuestionBlueprintVersionId;
  }): Promise<QuestionBlueprint | null> {
    return withTransaction(this.db, (tx) =>
      updateQuestionBlueprintDefinitionInTransaction(tx, input),
    );
  }

  private baseBlueprintQuery() {
    return this.db.selectFrom("questionBlueprints").selectAll();
  }
}

async function createQuestionBlueprintInTransaction(
  db: DatabaseExecutor,
  blueprint: QuestionBlueprint,
): Promise<QuestionBlueprint> {
  const row = await db
    .insertInto("questionBlueprints")
    .values(mapQuestionBlueprintToInsert(blueprint))
    .returningAll()
    .executeTakeFirstOrThrow();
  await insertQuestionBlueprintVersion(db, {
    blueprint: mapQuestionBlueprintRowToDomain(row),
    id: blueprint.currentVersionId,
    parentVersionId: null,
    publishedAt: blueprint.createdAt,
    versionNumber: 1,
  });
  return mapQuestionBlueprintRowToDomain(row);
}

async function updateQuestionBlueprintDefinitionInTransaction(
  db: DatabaseExecutor,
  input: {
    blueprint: QuestionBlueprint;
    versionId: QuestionBlueprintVersionId;
  },
): Promise<QuestionBlueprint | null> {
  const { blueprint } = input;
  const current = await db
    .selectFrom("questionBlueprints")
    .selectAll()
    .where("id", "=", blueprint.id)
    .forUpdate()
    .executeTakeFirst();
  if (!current) return null;

  const maxVersion = await db
    .selectFrom("questionBlueprintVersions")
    .select(({ fn }) => fn.max<number>("versionNumber").as("maxVersionNumber"))
    .where("blueprintId", "=", blueprint.id)
    .executeTakeFirst();
  const nextVersionNumber = Number(maxVersion?.maxVersionNumber ?? 0) + 1;
  const versionId = await insertQuestionBlueprintVersion(db, {
    blueprint,
    id: input.versionId,
    parentVersionId: questionBlueprintVersionId(current.currentVersionId),
    publishedAt: blueprint.updatedAt,
    versionNumber: nextVersionNumber,
  });

  const row = await db
    .updateTable("questionBlueprints")
    .set({
      ...mapQuestionBlueprintToUpdate(blueprint),
      currentVersionId: versionId,
    })
    .where("id", "=", blueprint.id)
    .returningAll()
    .executeTakeFirst();
  return row ? mapQuestionBlueprintRowToDomain(row) : null;
}

export async function insertQuestionBlueprintVersion(
  db: DatabaseExecutor,
  input: {
    blueprint: QuestionBlueprint;
    id: QuestionBlueprintVersionId;
    parentVersionId: QuestionBlueprintVersionId | null;
    publishedAt: Date;
    versionNumber: number;
  },
): Promise<QuestionBlueprintVersionId> {
  const version = createQuestionBlueprintVersion(
    {
      blueprintId: input.blueprint.id,
      createdByUserId: input.blueprint.createdByUserId,
      description: input.blueprint.description,
      document: input.blueprint.document,
      id: input.id,
      name: input.blueprint.name,
      ownerUserId: input.blueprint.ownerUserId,
      parentVersionId: input.parentVersionId,
      sources: input.blueprint.sources,
      versionNumber: questionBlueprintVersionNumber(input.versionNumber),
    },
    input.publishedAt,
  );
  const row = await db
    .insertInto("questionBlueprintVersions")
    .values(mapQuestionBlueprintVersionToInsert(version))
    .returning(["id"])
    .executeTakeFirstOrThrow();
  return row.id as QuestionBlueprintVersionId;
}

type TransactionCapable = {
  transaction(): {
    execute<T>(fn: (tx: DatabaseExecutor) => Promise<T>): Promise<T>;
  };
};

function hasTransaction(
  db: DatabaseExecutor,
): db is DatabaseExecutor & TransactionCapable {
  return "transaction" in db && typeof db.transaction === "function";
}

function withTransaction<T>(
  db: DatabaseExecutor,
  fn: (tx: DatabaseExecutor) => Promise<T>,
): Promise<T> {
  if (hasTransaction(db)) {
    return db.transaction().execute(fn);
  }
  return fn(db);
}
