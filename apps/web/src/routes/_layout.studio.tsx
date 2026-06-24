import { createFileRoute } from "@tanstack/react-router";
import { requireLogin } from "#/features/auth";
import { StudioPage, type StudioRouteSearch } from "#/features/questions";

export const Route = createFileRoute("/_layout/studio")({
  beforeLoad: requireLogin,
  component: RouteComponent,
  ssr: false,
  validateSearch: (search: Record<string, unknown>): StudioRouteSearch => ({
    blueprintId:
      typeof search.blueprintId === "string" ? search.blueprintId : undefined,
    draftId: typeof search.draftId === "string" ? search.draftId : undefined,
  }),
});

function RouteComponent() {
  const search = Route.useSearch();
  return (
    <StudioPage blueprintId={search.blueprintId} draftId={search.draftId} />
  );
}
