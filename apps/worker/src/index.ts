import { initializeNodeObservability } from "@lemma/observability/node";
import { config } from "./config.js";

const observability = await initializeNodeObservability({
  ...config.observability,
  serviceName: "lemma-worker",
  deploymentEnvironment: config.nodeEnv,
});

const { startWorker } = await import("./worker-main.js");

await startWorker({ observability });
