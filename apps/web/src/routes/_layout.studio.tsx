import { createFileRoute } from "@tanstack/react-router";
import { requireLogin } from "#/features/auth";
import { StudioPage, type StudioRouteSearch } from "#/features/questions";

export const Route = createFileRoute("/_layout/studio")({
  ssr: false,
  beforeLoad: requireLogin,
  validateSearch: (search: Record<string, unknown>): StudioRouteSearch => ({
    blueprintId:
      typeof search.blueprintId === "string" ? search.blueprintId : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  return <StudioPage blueprintId={search.blueprintId} />;
}
