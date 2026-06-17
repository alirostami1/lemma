import {
  type Attributes,
  type Counter,
  type Histogram,
  metrics,
  type ObservableResult,
  type Span,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";

export {
  compactLogFields,
  createConsoleStructuredLogger,
  errorLogFields,
  type LogFields,
  type StructuredLogger,
} from "./logging.js";

export type OperationStatus = "ok" | "error";

export type OperationKind = "internal" | "external";

export type OperationLineageLike = {
  requestId: string;
  correlationId: string;
  causationId?: string | null;
};

export type OperationInstrumentationInput = {
  name: string;
  packageName: string;
  component: string;
  operation: string;
  attributes?: Attributes;
  lineage?: OperationLineageLike | null;
};

export type ObservableGaugeRegistration = {
  unregister(): void;
};

export type OperationAttributes = Attributes;

export type InstrumentedOperationOptions = {
  attributes?: Attributes;
  lineage?: OperationLineageLike | null;
};

export type InstrumentedOperation<TOperation extends string = string> = {
  run<T>(operation: TOperation, fn: (span: Span) => Promise<T>): Promise<T>;
  run<T>(
    operation: TOperation,
    options: InstrumentedOperationOptions,
    fn: (span: Span) => Promise<T>,
  ): Promise<T>;
};

type MetricIdentity = Pick<
  OperationInstrumentationInput,
  "packageName" | "component" | "operation"
>;

type OperationInstruments = {
  operationCounter: Counter;
  operationDuration: Histogram;
  externalOperationCounter: Counter;
  externalOperationDuration: Histogram;
};

let operationInstruments: OperationInstruments | null = null;

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer("lemma");
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

export async function recordOperation<T>(
  input: OperationInstrumentationInput,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return recordInstrumentedOperation(input, "internal", fn);
}

export async function recordExternalOperation<T>(
  input: OperationInstrumentationInput,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return recordInstrumentedOperation(input, "external", fn);
}

export function instrumentService<TOperation extends string = string>(
  packageName: string,
  component: string,
): InstrumentedOperation<TOperation> {
  return createInstrumentedOperation<TOperation>(
    "internal",
    packageName,
    component,
  );
}

export function instrumentExternal<TOperation extends string = string>(
  packageName: string,
  component: string,
): InstrumentedOperation<TOperation> {
  return createInstrumentedOperation<TOperation>(
    "external",
    packageName,
    component,
  );
}

export function spanAttributesFromLineage(
  lineage: OperationLineageLike | null | undefined,
): Attributes {
  if (!lineage) {
    return {};
  }
  return {
    "operation.request_id": lineage.requestId,
    "operation.correlation_id": lineage.correlationId,
    ...(lineage.causationId
      ? { "operation.causation_id": lineage.causationId }
      : {}),
  };
}

export function registerObservableGauge(input: {
  name: string;
  description?: string;
  unit?: string;
  callback(result: ObservableResult): void | Promise<void>;
}): ObservableGaugeRegistration {
  const meter = metrics.getMeter("lemma");
  const gauge = meter.createObservableGauge(input.name, {
    description: input.description,
    unit: input.unit,
  });
  gauge.addCallback(input.callback);
  return {
    unregister() {
      gauge.removeCallback(input.callback);
    },
  };
}

function createInstrumentedOperation<TOperation extends string>(
  kind: OperationKind,
  packageName: string,
  component: string,
): InstrumentedOperation<TOperation> {
  return {
    run<T>(
      operation: TOperation,
      optionsOrFn: InstrumentedOperationOptions | ((span: Span) => Promise<T>),
      maybeFn?: (span: Span) => Promise<T>,
    ): Promise<T> {
      const options =
        typeof optionsOrFn === "function" ? undefined : optionsOrFn;
      const fn = typeof optionsOrFn === "function" ? optionsOrFn : maybeFn;
      if (!fn) {
        throw new Error("Instrumented operation callback is required.");
      }
      return recordInstrumentedOperation(
        {
          name: `${packageName}.${component}.${operation}`,
          packageName,
          component,
          operation,
          attributes: options?.attributes,
          lineage: options?.lineage,
        },
        kind,
        fn,
      );
    },
  };
}

async function recordInstrumentedOperation<T>(
  input: OperationInstrumentationInput,
  kind: OperationKind,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  let status: OperationStatus = "ok";
  try {
    return await withSpan(
      input.name,
      {
        "lemma.package": input.packageName,
        "lemma.component": input.component,
        "lemma.operation": input.operation,
        "lemma.operation_kind": kind,
        ...spanAttributesFromLineage(input.lineage),
        ...input.attributes,
      },
      fn,
    );
  } catch (error) {
    status = "error";
    throw error;
  } finally {
    recordOperationMetric(input, kind, status, elapsedSeconds(startedAt));
  }
}

function recordOperationMetric(
  input: MetricIdentity,
  kind: OperationKind,
  status: OperationStatus,
  durationSeconds: number,
): void {
  const instruments = getOperationInstruments();
  const attributes = metricAttributes(input, status);
  if (kind === "external") {
    instruments.externalOperationCounter.add(1, attributes);
    instruments.externalOperationDuration.record(durationSeconds, attributes);
    return;
  }
  instruments.operationCounter.add(1, attributes);
  instruments.operationDuration.record(durationSeconds, attributes);
}

function getOperationInstruments(): OperationInstruments {
  if (operationInstruments) {
    return operationInstruments;
  }
  const meter = metrics.getMeter("lemma");
  operationInstruments = {
    operationCounter: meter.createCounter("lemma_operation_total", {
      description: "Application operation count.",
    }),
    operationDuration: meter.createHistogram(
      "lemma_operation_duration_seconds",
      {
        description: "Application operation duration.",
        unit: "s",
      },
    ),
    externalOperationCounter: meter.createCounter(
      "lemma_external_operation_total",
      {
        description: "External dependency operation count.",
      },
    ),
    externalOperationDuration: meter.createHistogram(
      "lemma_external_operation_duration_seconds",
      {
        description: "External dependency operation duration.",
        unit: "s",
      },
    ),
  };
  return operationInstruments;
}

function metricAttributes(
  input: MetricIdentity,
  status: OperationStatus,
): Attributes {
  return {
    lemma_package: input.packageName,
    lemma_component: input.component,
    lemma_operation: input.operation,
    status,
  };
}

function elapsedSeconds(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt) / 1000;
}
