import type { DatabaseExecutor } from "@lemma/db";
import { sql } from "kysely";
import type { WorkbookCalculationSourceRecord } from "../application/ports.js";
import type { WorkbookCalculationSource } from "../application/workbook-calculation-sources.js";
import {
  type UserId,
  type WorkbookCalculation,
  type WorkbookCalculationStatus,
  type WorkbookId,
  type WorkbookSnapshot,
  workbookCalculationId,
  workbookCalculationStatus,
  workbookId,
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
      .innerJoin(
        "workbookCalculationSources",
        "workbookCalculationSources.calculationId",
        "workbookCalculations.id",
      )
      .selectAll("workbookCalculations")
      .distinct()
      .where("workbookCalculationSources.workbookId", "=", input.workbookId);
    if (input.statuses) {
      query = query.where("workbookCalculations.status", "in", input.statuses);
    }
    if (input.cursor) {
      query = query.where("workbookCalculations.createdAt", "<", input.cursor);
    }
    const rows = await query
      .orderBy("workbookCalculations.createdAt", "desc")
      .orderBy("workbookCalculations.id", "desc")
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

  async createWorkbookCalculationWithSources(input: {
    calculation: WorkbookCalculation;
    sources: readonly WorkbookCalculationSource[];
  }): Promise<WorkbookCalculation> {
    const row = await this.db
      .insertInto("workbookCalculations")
      .values(mapCalculationToInsert(input.calculation))
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.db
      .insertInto("workbookCalculationSources")
      .values(
        input.sources.map((source, index) => ({
          calculationId: input.calculation.id,
          position: index,
          sourceId: source.sourceId,
          workbookId: source.workbookId,
        })),
      )
      .execute();
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
        attempts: sql<number>`attempts + 1`,
        errorMessage: null,
        finishedAt: null,
        startedAt: at,
        status: workbookCalculationStatus("running"),
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

  async listWorkbookCalculationSources(
    calculationId: WorkbookCalculation["id"],
  ): Promise<WorkbookCalculationSourceRecord[]> {
    const rows = await this.db
      .selectFrom("workbookCalculationSources")
      .selectAll()
      .where("calculationId", "=", calculationId)
      .orderBy("position", "asc")
      .execute();
    return rows.map((row) => ({
      calculationId: workbookCalculationId(row.calculationId),
      createdAt: row.createdAt,
      position: row.position,
      sourceId: row.sourceId,
      workbookId: workbookId(row.workbookId),
    }));
  }
}
