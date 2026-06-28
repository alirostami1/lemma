import { Button } from "@lemma/ui/components/button";
import { Link } from "@tanstack/react-router";
import { PageContainer } from "#/components/patterns";
import { useQuestionBlueprintQuery } from "#/domains/questions/hooks";
import { getUserFacingApiErrorMessage } from "#/lib/errors/api-error";

export function QuestionBlueprintDetailPage({
  questionBlueprintId,
}: {
  questionBlueprintId: string;
}) {
  const blueprintQuery = useQuestionBlueprintQuery({
    questionBlueprintId,
  });

  if (blueprintQuery.isLoading) {
    return (
      <PageContainer variant="resource">
        <p className="text-sm text-muted-foreground">
          Loading published blueprint...
        </p>
      </PageContainer>
    );
  }

  if (blueprintQuery.isError) {
    return (
      <PageContainer variant="resource">
        <section className="grid gap-3 rounded-lg border bg-background p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Blueprint unavailable</h1>
          <p className="text-sm text-muted-foreground">
            {getUserFacingApiErrorMessage(
              blueprintQuery.error,
              "This blueprint could not be loaded.",
            )}
          </p>
          <Button
            onClick={() => {
              void blueprintQuery.refetch();
            }}
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </section>
      </PageContainer>
    );
  }

  const blueprint = blueprintQuery.data?.questionBlueprint;

  return (
    <PageContainer variant="resource">
      <section className="grid gap-4 rounded-lg border bg-background p-6 shadow-sm">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">
            Published blueprint
          </p>
          <h1 className="text-2xl font-semibold">
            {blueprint?.name ?? "Question blueprint"}
          </h1>
          {blueprint?.description ? (
            <p className="text-sm text-muted-foreground">
              {blueprint.description}
            </p>
          ) : null}
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <dt className="text-muted-foreground">Current version</dt>
            <dd className="font-medium">{blueprint?.currentVersionId}</dd>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <dt className="text-muted-foreground">Sources</dt>
            <dd className="font-medium">{blueprint?.sources.length ?? 0}</dd>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <dt className="text-muted-foreground">Visibility</dt>
            <dd className="font-medium">{blueprint?.visibility}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link search={{ blueprintId: questionBlueprintId }} to="/studio">
              Edit in Studio
            </Link>
          </Button>
        </div>
      </section>
    </PageContainer>
  );
}
