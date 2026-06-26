import { createFileRoute } from "@tanstack/react-router";
import { requireLogin } from "#/features/auth";
import { StudioPage, type StudioRouteSearch } from "#/features/questions";
import { parseStudioRouteSearch } from "#/features/questions/studio/studio-route-intent";

export const Route = createFileRoute("/_layout/studio")({
  beforeLoad: requireLogin,
  component: RouteComponent,
  ssr: false,
  validateSearch: (search: Record<string, unknown>): StudioRouteSearch =>
    parseStudioRouteSearch(search),
});

function RouteComponent() {
  const search = Route.useSearch();
  return (
    <StudioPage
      blueprintId={search.blueprintId}
      draftId={search.draftId}
      new={search.new}
    />
  );
}
