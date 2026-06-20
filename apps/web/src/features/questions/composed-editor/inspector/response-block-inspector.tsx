import {
  type ComposedEditorModel,
  type ComposedResponseEditorBlock,
  type ComposedResponseField,
  updateComposedBlock,
  updateComposedResponseField,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  AnswerFieldSettings,
  CorrectAnswerSettings,
  GradingSettings,
} from "../shared/answer-authoring-fields";
import { InspectorSection } from "./inspector-section";

export function ResponseBlockInspector({
  model,
  block,
  referencePreviewCache,
  workbookEnabled,
  sources,
  previewSourceId,
  disabled,
  onModelChange,
}: {
  model: ComposedEditorModel;
  block: ComposedResponseEditorBlock;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
}) {
  const responseField = model.responseFields.find(
    (field) => field.id === block.responseFieldId,
  );

  if (!responseField) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        This answer block is missing its answer field.
      </div>
    );
  }

  function updateBlock(
    updater: (
      current: ComposedResponseEditorBlock,
    ) => ComposedResponseEditorBlock,
  ) {
    onModelChange(
      updateComposedBlock(model, block.id, (current) => {
        if (current.type !== "response") {
          throw new Error("Expected answer block.");
        }
        return updater(current);
      }),
    );
  }

  function updateField(
    updater: (field: ComposedResponseField) => ComposedResponseField,
  ) {
    onModelChange(
      updateComposedResponseField(model, block.responseFieldId, updater),
    );
  }

  return (
    <div className="grid gap-5">
      <InspectorSection title="Input">
        <AnswerFieldSettings
          responseField={responseField}
          label={block.label}
          placeholder={block.placeholder}
          disabled={disabled}
          showPromptFields={false}
          onResponseFieldChange={(field) => updateField(() => field)}
          onLabelChange={(label) =>
            updateBlock((current) => ({
              ...current,
              label,
            }))
          }
          onPlaceholderChange={(placeholder) =>
            updateBlock((current) => ({
              ...current,
              placeholder,
            }))
          }
        />
      </InspectorSection>

      <InspectorSection title="Scoring">
        <GradingSettings
          blockId={block.id}
          points={block.points}
          grading={block.grading}
          disabled={disabled}
          onPointsChange={(points) =>
            updateBlock((current) => ({
              ...current,
              points,
            }))
          }
          onGradingChange={(grading) =>
            updateBlock((current) => ({
              ...current,
              grading,
            }))
          }
        />
      </InspectorSection>

      <InspectorSection title="Correct answer">
        <CorrectAnswerSettings
          value={block.correctValueSource}
          model={model}
          referencePreviewCache={referencePreviewCache}
          valueType={responseField.type}
          workbookEnabled={workbookEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          disabled={disabled}
          onModelChange={onModelChange}
          onChange={(correctValueSource) =>
            updateBlock((current) => ({
              ...current,
              correctValueSource,
            }))
          }
          onCreatedReference={({ nextModel, referenceId }) => {
            onModelChange(
              updateComposedBlock(nextModel, block.id, (current) => {
                if (current.type !== "response") {
                  throw new Error("Expected answer block.");
                }

                return {
                  ...current,
                  correctValueSource: {
                    type: "reference",
                    referenceId,
                  },
                };
              }),
            );
          }}
        />
      </InspectorSection>
    </div>
  );
}
