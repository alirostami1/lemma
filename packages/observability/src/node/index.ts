import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

export {
  type InstrumentedOperation,
  type InstrumentedOperationOptions,
  instrumentExternal,
  instrumentService,
  type ObservableGaugeRegistration,
  type OperationAttributes,
  type OperationInstrumentationInput,
  type OperationLineageLike,
  recordExternalOperation,
  recordOperation,
  registerObservableGauge,
  spanAttributesFromLineage,
  withSpan,
} from "../index.js";

export type NodeObservabilityConfig = {
  enabled: boolean;
  serviceName: string;
  deploymentEnvironment: string;
  otlpEndpoint: string;
  metricExportIntervalMs: number;
  attributes?: Record<string, string | number | boolean>;
};

export type NodeObservability = {
  enabled: boolean;
  shutdown(): Promise<void>;
};

let activeSdk: NodeSDK | null = null;

export async function initializeNodeObservability(
  config: NodeObservabilityConfig,
): Promise<NodeObservability> {
  if (!config.enabled) {
    return disabledObservability;
  }
  if (activeSdk) {
    return {
      enabled: true,
      shutdown: () => shutdownActiveSdk(),
    };
  }

  const endpoint = trimTrailingSlash(config.otlpEndpoint);
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": config.serviceName,
      "deployment.environment.name": config.deploymentEnvironment,
      ...config.attributes,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${endpoint}/v1/metrics`,
      }),
      exportIntervalMillis: config.metricExportIntervalMs,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
      }),
    ],
  });

  activeSdk = sdk;
  await Promise.resolve(sdk.start());

  return {
    enabled: true,
    shutdown: () => shutdownActiveSdk(),
  };
}

async function shutdownActiveSdk(): Promise<void> {
  if (!activeSdk) {
    return;
  }
  const sdk = activeSdk;
  activeSdk = null;
  await sdk.shutdown();
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const disabledObservability: NodeObservability = {
  enabled: false,
  shutdown: () => Promise.resolve(),
};
