import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "#/features/home";

export const Route = createFileRoute("/_layout/")({
  head: () => ({
    meta: [
      {
        title: "Lemma | Home",
      },
      {
        name: "description",
        content:
          "Create reusable blueprints and generate questions into question sets.",
      },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <HomePage />;
}
