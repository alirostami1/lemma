import { Button } from "@lemma/ui/components/button";
import { InlineError } from "@lemma/ui/components/inline-error";
import { RefreshCw } from "lucide-react";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import { getGenerationStatusState } from "./generation-error-state";

export type GenerationStatusBannerProps = {
  run: QuestionGenerationRun | null;
  errorMessage: string | null;
  isRetrying: boolean;
  onRetry(): void;
};

export function GenerationStatusBanner({
  run,
  errorMessage,
  isRetrying,
  onRetry,
}: GenerationStatusBannerProps) {
  const state = getGenerationStatusState(run, errorMessage);

  if (state.hidden) {
    return null;
  }

  return (
    <section className="rounded-lg border bg-background/95 p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid min-w-0 gap-1">
          <h2 className="text-sm font-semibold">{state.title}</h2>
          <p className="text-sm text-muted-foreground">{state.description}</p>
          {state.message ? <InlineError message={state.message} /> : null}
        </div>
        {state.canRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit shrink-0"
            disabled={isRetrying}
            onClick={onRetry}
          >
            <RefreshCw />
            {isRetrying ? "Retrying..." : "Retry"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
