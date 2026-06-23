import { createFileRoute } from "@tanstack/react-router";
import { requireLogin } from "#/features/auth";
import { CreatePage } from "#/features/create-flow";

export const Route = createFileRoute("/_layout/create")({
  beforeLoad: requireLogin,
  component: RouteComponent,
  ssr: false,
});

function RouteComponent() {
  return <CreatePage />;
}
