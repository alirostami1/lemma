import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "#/features/home";

export const Route = createFileRoute("/_layout/")({
  component: RouteComponent,
  head: () => ({
    meta: [
      {
        title: "Lemma | Home",
      },
      {
        content:
          "Create reusable blueprints and generate questions into question sets.",
        name: "description",
      },
    ],
  }),
});

function RouteComponent() {
  return <HomePage />;
}
