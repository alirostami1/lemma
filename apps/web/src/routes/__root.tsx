import { Toaster } from "@lemma/ui/components/sonner";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { RealtimeNotificationsProvider } from "#/domains/realtime";
import { NotFoundPage, RootErrorBoundary } from "#/features/errors";
import { TanStackQueryDevtools } from "../integrations/tanstack-query/devtools";
import "#/styles.css";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Lemma",
      },
    ],
  }),
  errorComponent: RootErrorBoundary,
  notFoundComponent: () => <NotFoundPage />,
  component: RootRouteComponent,
  shellComponent: RootDocument,
});

function RootRouteComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <RealtimeNotificationsProvider queryClient={queryClient}>
      <Outlet />
    </RealtimeNotificationsProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster richColors closeButton />
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
