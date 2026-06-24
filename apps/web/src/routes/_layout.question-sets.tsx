import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireLogin } from "#/features/auth";

export const Route = createFileRoute("/_layout/question-sets")({
  beforeLoad: requireLogin,
  component: RouteComponent,
  ssr: false,
});

function RouteComponent() {
  return <Outlet />;
}
