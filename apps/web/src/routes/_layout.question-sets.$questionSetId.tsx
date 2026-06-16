import { createFileRoute } from "@tanstack/react-router";
import { QuestionSetDetailPage } from "#/features/questions";

export const Route = createFileRoute("/_layout/question-sets/$questionSetId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { questionSetId } = Route.useParams();
  return <QuestionSetDetailPage questionSetId={questionSetId} />;
}
