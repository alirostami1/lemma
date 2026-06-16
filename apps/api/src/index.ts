import { initializeNodeObservability } from "@lemma/observability/node";
import { config } from "./config.js";

const observability = await initializeNodeObservability({
  ...config.observability,
  serviceName: "lemma-api",
  deploymentEnvironment: config.nodeEnv,
});

const { startApiServer } = await import("./server.js");

startApiServer({ observability });
