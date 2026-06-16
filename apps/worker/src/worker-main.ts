import type { NodeObservability } from "@lemma/observability/node";
import { createWorkerRuntime } from "./create-worker-runtime.js";
import { logWorkerError, logWorkerInfo } from "./worker-logging.js";

export async function startWorker(input: {
  observability: NodeObservability;
}): Promise<void> {
  const runtime = createWorkerRuntime();

  await runtime.start();

  logWorkerInfo("worker started");

  async function shutdown(signal: NodeJS.Signals) {
    try {
      await runtime.stop();
      await input.observability.shutdown();
      logWorkerInfo("worker stopped", { signal });
      process.exit(0);
    } catch (error) {
      logWorkerError("worker shutdown failed", { signal }, error);
      process.exit(1);
    }
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
