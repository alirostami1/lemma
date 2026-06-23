import type { DatabaseExecutor } from "@lemma/db";
import type { WorkbookSnapshotGenerationMetadata } from "../application/ports.js";
import {
  type WorkbookCalculation,
  type WorkbookSnapshot,
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
} from "../domain/index.js";
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

  async listWorkbookSnapshotMetadataForCalculation(
    calculationId: WorkbookCalculation["id"],
  ): Promise<readonly WorkbookSnapshotGenerationMetadata[]> {
    const rows = await this.db
      .selectFrom("workbookSnapshots")
      .select([
        "id",
        "calculationId",
        "sourceId",
        "workbookId",
        "questionIndex",
        "snapshotIndex",
      ])
      .where("calculationId", "=", calculationId)
      .orderBy("snapshotIndex", "asc")
      .execute();
    return rows.map(
      (row): WorkbookSnapshotGenerationMetadata => ({
        calculationId: workbookCalculationId(row.calculationId),
        id: workbookSnapshotId(row.id),
        questionIndex: row.questionIndex,
        snapshotIndex: row.snapshotIndex,
        sourceId: row.sourceId,
        workbookId: workbookId(row.workbookId),
      }),
    );
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
