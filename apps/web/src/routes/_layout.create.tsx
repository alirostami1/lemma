import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/create")({
  beforeLoad: redirectCreateToStudio,
});

export function redirectCreateToStudio(): never {
  throw redirect({ replace: true, to: "/studio" });
}
