import { createFileRoute } from "@tanstack/react-router";
import { requireLogin } from "#/features/auth";
import { CreatePage } from "#/features/create-flow";

export const Route = createFileRoute("/_layout/create")({
  ssr: false,
  beforeLoad: requireLogin,
  component: RouteComponent,
});

function RouteComponent() {
  return <CreatePage />;
}
