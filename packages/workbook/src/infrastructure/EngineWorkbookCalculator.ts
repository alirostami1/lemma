import { instrumentExternal } from "@lemma/observability";
import {
  type WorkbookEngineConfig,
  WorkbookEngineError,
  type WorkbookEngineOperationOptions,
} from "@lemma/workbook-engine/domain";
import {
  getWorkbookEngineHealth,
  inspectWorkbook,
  readCachedWorkbookValues,
  recalculateWorkbook,
  recalculateWorkbookBatch,
} from "@lemma/workbook-engine/runtime";
import { WorkbookEngineFailureError } from "../application/errors.js";
import type {
  WorkbookCalculator,
  WorkbookCalculatorOptions,
} from "../application/ports.js";
import {
  type WorkbookInspection,
  type WorkbookReferenceTargetAvailability,
  workbookReferenceTargetsFromSparseValues,
} from "../domain/index.js";

const instrumentation = instrumentExternal("workbook", "engine");

export class EngineWorkbookCalculator implements WorkbookCalculator {
  constructor(private readonly config: WorkbookEngineConfig) {}

  async inspect(
    path: string,
    options?: WorkbookCalculatorOptions,
  ): Promise<WorkbookInspection> {
    return this.engineOperation("inspect", {}, options, () =>
      this.withWorkbookEngineError(async () => {
        const engineOptions = workbookEngineOptions(options);
        const inspection = await inspectWorkbook(
          path,
          this.config,
          engineOptions,
        );
        const health = await getWorkbookEngineHealth(
          this.config,
          engineOptions,
        );
        return { ...inspection, libreOfficeVersion: health.version };
      }),
    );
  }

  async calculate(path: string, options?: WorkbookCalculatorOptions) {
    return this.engineOperation("calculate", {}, options, () =>
      this.withWorkbookEngineError(() =>
        recalculateWorkbook(path, this.config, workbookEngineOptions(options)),
      ),
    );
  }

  async referenceTargets(
    path: string,
    options?: WorkbookCalculatorOptions,
  ): Promise<WorkbookReferenceTargetAvailability> {
    return this.engineOperation("reference_targets", {}, options, async () => {
      try {
        const values = await readCachedWorkbookValues(
          path,
          this.config,
          workbookEngineOptions(options),
        );
        return {
          status: "available" as const,
          targets: workbookReferenceTargetsFromSparseValues(values),
        };
      } catch (error) {
        if (error instanceof WorkbookEngineError) {
          const reason =
            error.code === "engine_unavailable" ||
            error.code === "engine_timeout" ||
            error.code === "engine_response_invalid" ||
            error.code === "engine_response_too_large"
              ? "inspection_unavailable"
              : "invalid_workbook";
          return {
            reason,
            status: "unavailable" as const,
          };
        }
        return {
          reason: "inspection_unavailable" as const,
          status: "unavailable" as const,
        };
      }
    });
  }

  async calculateBatch(
    path: string,
    count: number,
    options?: WorkbookCalculatorOptions,
  ) {
    return this.engineOperation(
      "calculate_batch",
      { "workbook.snapshot_count": count },
      options,
      () =>
        this.withWorkbookEngineError(() =>
          recalculateWorkbookBatch(
            path,
            count,
            this.config,
            workbookEngineOptions(options),
          ),
        ),
    );
  }

  async health(options?: WorkbookCalculatorOptions) {
    return this.engineOperation("health", {}, options, () =>
      this.withWorkbookEngineError(() =>
        getWorkbookEngineHealth(this.config, workbookEngineOptions(options)),
      ),
    );
  }

  private async withWorkbookEngineError<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof WorkbookEngineError) {
        throw new WorkbookEngineFailureError(error.message, error.code, {
          cause: error,
        });
      }
      throw new WorkbookEngineFailureError(
        error instanceof Error ? error.message : "workbook engine failed",
        "engine_failure",
        { cause: error },
      );
    }
  }

  private async engineOperation<T>(
    operation: string,
    attributes: Record<string, string | number | boolean>,
    options: WorkbookCalculatorOptions | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(
      operation,
      {
        attributes: {
          "workbook.engine": this.config.engine,
          ...attributes,
        },
        lineage: options?.lineage,
      },
      fn,
    );
  }
}

function workbookEngineOptions(
  options?: WorkbookCalculatorOptions,
): WorkbookEngineOperationOptions | undefined {
  const requestId = options?.lineage?.requestId;
  return requestId ? { requestId } : undefined;
}
