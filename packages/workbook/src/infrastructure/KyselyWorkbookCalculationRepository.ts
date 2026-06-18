import type { DatabaseExecutor } from "@lemma/db";
import { sql } from "kysely";
import {
  type UserId,
  type WorkbookCalculation,
  type WorkbookCalculationStatus,
  type WorkbookId,
  type WorkbookSnapshot,
  workbookCalculationStatus,
} from "../domain/index.js";
import {
  mapCalculationRowToDomain,
  mapCalculationToInsert,
  mapCalculationToUpdate,
} from "./KyselyWorkbookMappers.js";
import { KyselyWorkbookSnapshotRepository } from "./KyselyWorkbookSnapshotRepository.js";

export class KyselyWorkbookCalculationRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async listWorkbookCalculationsByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses?: readonly WorkbookCalculationStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<WorkbookCalculation[]> {
    let query = this.db
      .selectFrom("workbookCalculations")
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
    return rows.map(mapCalculationRowToDomain);
  }

  async listWorkbookCalculationsByWorkbookId(input: {
    workbookId: WorkbookId;
    statuses?: readonly WorkbookCalculationStatus[];
    limit: number;
    cursor?: Date;
  }): Promise<WorkbookCalculation[]> {
    let query = this.db
      .selectFrom("workbookCalculations")
      .selectAll()
      .where("workbookId", "=", input.workbookId);
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
    return rows.map(mapCalculationRowToDomain);
  }

  async findWorkbookCalculationById(
    id: WorkbookCalculation["id"],
  ): Promise<WorkbookCalculation | null> {
    const row = await this.db
      .selectFrom("workbookCalculations")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? mapCalculationRowToDomain(row) : null;
  }

  async findWorkbookCalculationByCorrelationId(
    correlationId: string,
  ): Promise<WorkbookCalculation | null> {
    const row = await this.db
      .selectFrom("workbookCalculations")
      .selectAll()
      .where("correlationId", "=", correlationId)
      .orderBy("createdAt", "asc")
      .executeTakeFirst();
    return row ? mapCalculationRowToDomain(row) : null;
  }

  async createWorkbookCalculation(
    calculation: WorkbookCalculation,
  ): Promise<WorkbookCalculation> {
    const row = await this.db
      .insertInto("workbookCalculations")
      .values(mapCalculationToInsert(calculation))
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapCalculationRowToDomain(row);
  }

  async updateWorkbookCalculation(
    calculation: WorkbookCalculation,
  ): Promise<WorkbookCalculation | null> {
    const row = await this.db
      .updateTable("workbookCalculations")
      .set(mapCalculationToUpdate(calculation))
      .where("id", "=", calculation.id)
      .returningAll()
      .executeTakeFirst();
    return row ? mapCalculationRowToDomain(row) : null;
  }

  async claimQueuedWorkbookCalculation(
    id: WorkbookCalculation["id"],
    at: Date,
  ): Promise<WorkbookCalculation | null> {
    const row = await this.db
      .updateTable("workbookCalculations")
      .set({
        status: workbookCalculationStatus("running"),
        attempts: sql<number>`attempts + 1`,
        errorMessage: null,
        finishedAt: null,
        startedAt: at,
        updatedAt: at,
      })
      .where("id", "=", id)
      .where("status", "=", workbookCalculationStatus("queued"))
      .returningAll()
      .executeTakeFirst();
    return row ? mapCalculationRowToDomain(row) : null;
  }

  async completeWorkbookCalculation(input: {
    calculation: WorkbookCalculation;
    snapshots: readonly WorkbookSnapshot[];
  }): Promise<{
    calculation: WorkbookCalculation;
    snapshots: WorkbookSnapshot[];
  }> {
    const complete = async (db: DatabaseExecutor) => {
      const calculations = new KyselyWorkbookCalculationRepository(db);
      const snapshots = new KyselyWorkbookSnapshotRepository(db);
      const calculation = await calculations.updateWorkbookCalculation(
        input.calculation,
      );
      return {
        calculation: calculation ?? input.calculation,
        snapshots: await snapshots.createWorkbookSnapshots(input.snapshots),
      };
    };

    return complete(this.db);
  }
}
