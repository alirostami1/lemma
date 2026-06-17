import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { KcPage } from "./kc.gen";
import "./styles.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Missing #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    {window.kcContext ? (
      <KcPage kcContext={window.kcContext} />
    ) : (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <p className="text-sm text-muted-foreground">No Keycloak context.</p>
      </div>
    )}
  </StrictMode>,
);
