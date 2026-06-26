import { createFileRoute } from "@tanstack/react-router";
import { requireLogin } from "#/features/auth";
import { QuestionBlueprintDetailPage } from "#/features/questions";

export const Route = createFileRoute(
  "/_layout/question-blueprints/$questionBlueprintId",
)({
  beforeLoad: requireLogin,
  component: RouteComponent,
  ssr: false,
});

function RouteComponent() {
  const { questionBlueprintId } = Route.useParams();
  return (
    <QuestionBlueprintDetailPage questionBlueprintId={questionBlueprintId} />
  );
}
