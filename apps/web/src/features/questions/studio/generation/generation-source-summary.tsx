import type { GenerateQuestionsDialogSource } from "./generation-controller-types";

export function GenerationSourceSummary({
  source,
}: {
  source: GenerateQuestionsDialogSource | null;
}) {
  return (
    <>
      {source
        ? source.sources.length === 0
          ? "No sources attached to saved blueprint. Select question set for generated questions."
          : source.sources.length === 1
            ? `Uses source: ${source.sources[0]?.name ?? "Source"}. Select question set for generated questions.`
            : `Uses ${source.sources.length} sources attached to saved blueprint. Select question set for generated questions.`
        : "Choose saved blueprint first."}
    </>
  );
}
