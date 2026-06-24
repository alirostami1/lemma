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
  workbookSheetNamesBySourceId,
  disabled,
  onModelChange,
}: {
  model: ComposedEditorModel;
  block: ComposedResponseEditorBlock;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
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
          disabled={disabled}
          label={block.label}
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
          onResponseFieldChange={(field) => updateField(() => field)}
          placeholder={block.placeholder}
          responseField={responseField}
          showPromptFields={false}
        />
      </InspectorSection>

      <InspectorSection title="Scoring">
        <GradingSettings
          blockId={block.id}
          disabled={disabled}
          grading={block.grading}
          onGradingChange={(grading) =>
            updateBlock((current) => ({
              ...current,
              grading,
            }))
          }
          onPointsChange={(points) =>
            updateBlock((current) => ({
              ...current,
              points,
            }))
          }
          points={block.points}
        />
      </InspectorSection>

      <InspectorSection title="Correct answer">
        <CorrectAnswerSettings
          disabled={disabled}
          model={model}
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
                    referenceId,
                    type: "reference",
                  },
                };
              }),
            );
          }}
          onModelChange={onModelChange}
          referencePreviewCache={referencePreviewCache}
          sources={sources}
          value={block.correctValueSource}
          valueType={responseField.type}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
      </InspectorSection>
    </div>
  );
}
