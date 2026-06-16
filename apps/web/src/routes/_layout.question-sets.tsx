import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireLogin } from "#/features/auth";

export const Route = createFileRoute("/_layout/question-sets")({
  ssr: false,
  beforeLoad: requireLogin,
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
