import { Toaster } from "@lemma/ui/components/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { OidcInitializationGate } from "./lib/oidc";
import { createQueryClient } from "./query-client";
import "./styles.css";

function Root() {
  const [queryClient] = useState(createQueryClient);

  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <OidcInitializationGate>
          <App />
        </OidcInitializationGate>
        <Toaster richColors closeButton />
      </QueryClientProvider>
    </StrictMode>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found.");
}

createRoot(rootElement).render(<Root />);
