import type { GenerateQuestionsDialogSource } from "./generation-controller-types";

export function GenerationSourceSummary({
  source,
}: {
  source: GenerateQuestionsDialogSource | null;
}) {
  return (
    <>
      {source
        ? source.workbookName
          ? `Uses source: ${source.workbookName}. Select question set for generated questions.`
          : "Uses source attached to saved blueprint. Select question set for generated questions."
        : "Choose saved blueprint first."}
    </>
  );
}
