import { createFileRoute } from "@tanstack/react-router";
import { QuestionDetailPage } from "#/features/questions";

export const Route = createFileRoute(
  "/_layout/question-sets/$questionSetId_/questions/$questionId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { questionId, questionSetId } = Route.useParams();
  return (
    <QuestionDetailPage questionId={questionId} questionSetId={questionSetId} />
  );
}
