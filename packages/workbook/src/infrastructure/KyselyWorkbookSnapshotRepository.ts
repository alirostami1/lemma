import type { DatabaseExecutor } from "@lemma/db";
import type { WorkbookCalculation, WorkbookSnapshot } from "../domain/index.js";
import {
  mapSnapshotRowToDomain,
  mapSnapshotToInsert,
} from "./KyselyWorkbookMappers.js";

export class KyselyWorkbookSnapshotRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async findWorkbookSnapshotById(
    id: WorkbookSnapshot["id"],
  ): Promise<WorkbookSnapshot | null> {
    const row = await this.db
      .selectFrom("workbookSnapshots")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapSnapshotRowToDomain(row) : null;
  }

  async listWorkbookSnapshotsByCalculationId(input: {
    calculationId: WorkbookCalculation["id"];
    limit: number;
    cursor?: number;
  }): Promise<WorkbookSnapshot[]> {
    let query = this.db
      .selectFrom("workbookSnapshots")
      .selectAll()
      .where("calculationId", "=", input.calculationId);
    if (input.cursor !== undefined) {
      query = query.where("snapshotIndex", ">", input.cursor);
    }
    const rows = await query
      .orderBy("snapshotIndex", "asc")
      .limit(input.limit)
      .execute();
    return rows.map(mapSnapshotRowToDomain);
  }

  async createWorkbookSnapshots(
    snapshots: readonly WorkbookSnapshot[],
  ): Promise<WorkbookSnapshot[]> {
    if (snapshots.length === 0) {
      return [];
    }
    const rows = await this.db
      .insertInto("workbookSnapshots")
      .values(snapshots.map(mapSnapshotToInsert))
      .returningAll()
      .execute();
    return rows.map(mapSnapshotRowToDomain);
  }
}
