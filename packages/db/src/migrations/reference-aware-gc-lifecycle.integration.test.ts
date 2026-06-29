import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createDatabaseMigrator } from "../index.js";
import {
  startTestDatabase,
  type TestDatabase,
} from "../testing/testcontainers-postgres.js";

let testDatabase: TestDatabase | null = null;

before(async () => {
  testDatabase = await startTestDatabase({
    context: "db migration integration tests",
    migrateTo: "0011_create_question_blueprint_drafts",
  });
});

after(async () => {
  await testDatabase?.stop();
});

test("0012 backfills old file tombstone state before enforcing lifecycle constraints", async () => {
  const db = requireTestDatabase().db;
  const userId = "019e9315-6a87-715f-9861-8654df190001";
  const deletedWithDeletedAtId = "019e9315-6a87-715f-9861-8654df190002";
  const uploadedWithDeletedAtId = "019e9315-6a87-715f-9861-8654df190003";
  const deletedWithoutDeletedAtId = "019e9315-6a87-715f-9861-8654df190004";
  const deletedAt = new Date("2026-01-01T00:00:00.000Z");
  const updatedAt = new Date("2026-02-01T00:00:00.000Z");

  await db
    .insertInto("users")
    .values({
      displayName: "Migration User",
      email: "migration-user@example.com",
      id: userId,
      identityId: `identity:${userId}`,
      status: "active",
    })
    .execute();

  await insertPre0012File({
    createdByUserId: userId,
    deletedAt,
    id: deletedWithDeletedAtId,
    ownerUserId: userId,
    status: "deleted",
    updatedAt,
  });
  await insertPre0012File({
    createdByUserId: userId,
    deletedAt,
    id: uploadedWithDeletedAtId,
    ownerUserId: userId,
    status: "uploaded",
    updatedAt,
  });
  await insertPre0012File({
    createdByUserId: userId,
    deletedAt: null,
    id: deletedWithoutDeletedAtId,
    ownerUserId: userId,
    status: "deleted",
    updatedAt,
  });

  const migrationResult = await createDatabaseMigrator(db).migrateToLatest();
  assert.ifError(migrationResult.error);

  const rows = await db
    .selectFrom("files")
    .select(["id", "status", "deletedAt", "retentionExpiresAt"])
    .where("id", "in", [
      deletedWithDeletedAtId,
      uploadedWithDeletedAtId,
      deletedWithoutDeletedAtId,
    ])
    .orderBy("id")
    .execute();
  assert.equal(rows.length, 3);
  const byId = new Map(rows.map((row) => [row.id, row]));

  assert.deepEqual(byId.get(deletedWithDeletedAtId), {
    deletedAt,
    id: deletedWithDeletedAtId,
    retentionExpiresAt: new Date("2026-01-31T00:00:00.000Z"),
    status: "deleted",
  });
  assert.deepEqual(byId.get(uploadedWithDeletedAtId), {
    deletedAt,
    id: uploadedWithDeletedAtId,
    retentionExpiresAt: new Date("2026-01-31T00:00:00.000Z"),
    status: "deleted",
  });
  assert.deepEqual(byId.get(deletedWithoutDeletedAtId), {
    deletedAt: updatedAt,
    id: deletedWithoutDeletedAtId,
    retentionExpiresAt: new Date("2026-03-03T00:00:00.000Z"),
    status: "deleted",
  });

  await assert.rejects(() =>
    db
      .insertInto("files")
      .values({
        bucket: "bucket",
        byteSize: 1,
        checksumSha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        contentType: "application/octet-stream",
        createdByUserId: userId,
        deletedAt,
        id: "019e9315-6a87-715f-9861-8654df190005",
        metadata: {},
        objectKey: "invalid",
        originalName: "invalid.bin",
        ownerUserId: userId,
        purpose: "workbook",
        status: "uploaded",
      })
      .execute(),
  );

  async function insertPre0012File(input: {
    createdByUserId: string;
    deletedAt: Date | null;
    id: string;
    ownerUserId: string;
    status: "deleted" | "uploaded";
    updatedAt: Date;
  }): Promise<void> {
    await db
      .insertInto("files")
      .values({
        bucket: "bucket",
        byteSize: 1,
        checksumSha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        contentType: "application/octet-stream",
        createdByUserId: input.createdByUserId,
        deletedAt: input.deletedAt,
        id: input.id,
        metadata: {},
        objectKey: input.id,
        originalName: `${input.id}.bin`,
        ownerUserId: input.ownerUserId,
        purpose: "workbook",
        status: input.status,
        updatedAt: input.updatedAt,
      })
      .execute();
  }
});

function requireTestDatabase(): TestDatabase {
  if (!testDatabase) throw new Error("test database not started");
  return testDatabase;
}
