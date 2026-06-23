import { vi } from "vitest";

vi.stubEnv("LEMMA_WEB_APP_TITLE", "Lemma");
vi.stubEnv("LEMMA_WEB_APP_URL", "http://localhost:3000");
vi.stubEnv("LEMMA_WEB_API_URL", "http://localhost:3000");
vi.stubEnv(
  "LEMMA_WEB_REALTIME_URL",
  "ws://localhost:3000/connection/websocket",
);
vi.stubEnv("LEMMA_WEB_OIDC_ISSUER_URI", "http://localhost:3001");
vi.stubEnv("LEMMA_WEB_OIDC_CLIENT_ID", "lemma-web");
