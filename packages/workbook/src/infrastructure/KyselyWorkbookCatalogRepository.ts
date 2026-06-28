import type { DatabaseExecutor } from "@lemma/db";
import { WorkbookRepositoryDataError } from "../application/errors.js";
import type {
  FileId,
  UserId,
  Workbook,
  WorkbookId,
  WorkbookStatus,
} from "../domain/index.js";
import {
  mapWorkbookRowToDomain,
  mapWorkbookToInsert,
  mapWorkbookToUpdate,
} from "./KyselyWorkbookMappers.js";

export class KyselyWorkbookCatalogRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async listWorkbooksByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly WorkbookStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<Workbook[]> {
    let query = this.db
      .selectFrom("workbooks")
      .selectAll()
      .where("ownerUserId", "=", input.ownerUserId);
    if (input.statuses) {
      query = query.where("status", "in", input.statuses);
    }
    if (input.cursor) {
      query = query.where("createdAt", "<", input.cursor);
    }
    const rows = await query
      .orderBy("createdAt", "desc")
      .limit(input.limit)
      .execute();
    return rows.map(mapWorkbookRowToDomain);
  }

  async findWorkbookById(id: WorkbookId): Promise<Workbook | null> {
    const row = await this.db
      .selectFrom("workbooks")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapWorkbookRowToDomain(row) : null;
  }

  async findWorkbookByOwnerUserIdAndFileId(input: {
    ownerUserId: UserId;
    fileId: FileId;
  }): Promise<Workbook | null> {
    const row = await this.db
      .selectFrom("workbooks")
      .selectAll()
      .where("ownerUserId", "=", input.ownerUserId)
      .where("fileId", "=", input.fileId)
      .executeTakeFirst();
    return row ? mapWorkbookRowToDomain(row) : null;
  }

  async createWorkbook(workbook: Workbook): Promise<Workbook> {
    const row = await this.db
      .insertInto("workbooks")
      .values(mapWorkbookToInsert(workbook))
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapWorkbookRowToDomain(row);
  }

  async createWorkbookIfAbsentByOwnerAndFile(input: {
    workbook: Workbook;
  }): Promise<{
    workbook: Workbook;
    created: boolean;
  }> {
    const inserted = await this.db
      .insertInto("workbooks")
      .values(mapWorkbookToInsert(input.workbook))
      .onConflict((conflict) =>
        conflict.columns(["ownerUserId", "fileId"]).doNothing(),
      )
      .returningAll()
      .executeTakeFirst();
    if (inserted) {
      return {
        created: true,
        workbook: mapWorkbookRowToDomain(inserted),
      };
    }

    const existing = await this.findWorkbookByOwnerUserIdAndFileId({
      fileId: input.workbook.fileId,
      ownerUserId: input.workbook.ownerUserId,
    });
    if (!existing) {
      throw new WorkbookRepositoryDataError(
        "Workbook owner/file registration conflicted but no persisted workbook was found.",
      );
    }
    return { created: false, workbook: existing };
  }

  async updateWorkbook(workbook: Workbook): Promise<Workbook | null> {
    const row = await this.db
      .updateTable("workbooks")
      .set(mapWorkbookToUpdate(workbook))
      .where("id", "=", workbook.id)
      .returningAll()
      .executeTakeFirst();
    return row ? mapWorkbookRowToDomain(row) : null;
  }
}
