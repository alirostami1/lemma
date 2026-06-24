import { initializeNodeObservability } from "@lemma/observability/node";
import { config } from "./config.js";

const observability = await initializeNodeObservability({
  ...config.observability,
  deploymentEnvironment: config.nodeEnv,
  serviceName: "lemma-worker",
});

const { startWorker } = await import("./worker-main.js");

await startWorker({ observability });
