import { createFileRoute } from "@tanstack/react-router";
import { QuestionSetListPage } from "#/features/questions";

export const Route = createFileRoute("/_layout/question-sets/")({
  component: QuestionSetListPage,
});
