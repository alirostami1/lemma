import { Button } from "@lemma/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import {
  applyInputGrading,
  type ComposedEditorModel,
  createDefaultCorrectValueSource,
  deriveResponseFieldRequiredFromInput,
  getPrimaryTableInputBlock,
  getPrimaryTableTextBlock,
  getTableCellPrimitiveBlocks,
  normalizeInputPrimitiveForType,
  requiresCorrectValueSource,
  setInputPrimitiveRequired,
  type TableEditorCell,
  type TableEditorInputBlock,
  type TableEditorModel,
  type TableEditorTextBlock,
  type TableResponseField,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  makeContentCell,
  makeResponseCell,
  repairMissingAnswerFieldForCell,
  updateResponseFieldForCell,
  updateTableCell,
  updateTableCellInputBlockCorrectValueSource,
  updateTableCellTextBlockContent,
} from "#/features/questions/table-block-editor";
import {
  AnswerFieldSettings,
  CorrectAnswerSettings,
  GradingSettings,
  InputPrimitiveSettings,
} from "../shared/answer-authoring-fields";
import { TextAuthoringContent } from "../shared/text-authoring-content";
import { InspectorField } from "./inspector-field";
import { InspectorSection } from "./inspector-section";
import { getTableCellInspectorViewModel } from "./table-cell-inspector-view-model";
import {
  updateTableCellValueInComposedModel,
  updateTableContentCellInlineContentInComposedModel,
} from "./table-cell-reference-operations";

export function TableCellInspector({
  model,
  tableBlockId,
  cellId,
  editorModel,
  referencePreviewCache,
  workbookEnabled,
  sources = [],
  workbookSheetNamesBySourceId,
  disabled,
  onModelChange,
  onEditorModelChange,
}: {
  model: TableEditorModel;
  tableBlockId: string;
  cellId: string;
  editorModel: ComposedEditorModel;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources?: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onEditorModelChange(model: ComposedEditorModel): void;
}) {
  const viewModel = getTableCellInspectorViewModel(model, cellId);
  if (viewModel.status === "missing_cell") {
    return <p className="text-sm text-muted-foreground">Select a cell.</p>;
  }
  const { cell, context, kind, responseField, title } = viewModel;
  const textBlock = getPrimaryTableTextBlock(cell);
  const inputBlock = getPrimaryTableInputBlock(cell);

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {context ? (
          <p className="text-xs text-muted-foreground">{context}</p>
        ) : null}
      </div>
      <InspectorSection title="Cell">
        <InspectorField label="Type">
          <Select
            disabled={disabled}
            onValueChange={(value) => {
              if (value === "content") {
                onModelChange(makeContentCell(model, cell.id));
                return;
              }
              if (value === "response") {
                onModelChange(makeResponseCell(model, cell.id));
              }
            }}
            value={kind}
          >
            <SelectTrigger aria-label="Type">
              <SelectValue placeholder="Cell type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="content">Content</SelectItem>
              <SelectItem value="response">Answer</SelectItem>
            </SelectContent>
          </Select>
        </InspectorField>
      </InspectorSection>
      {kind === "content" && textBlock ? (
        <InspectorSection title="Content">
          <ContentCellSettings
            cell={cell}
            disabled={disabled}
            editorModel={editorModel}
            model={model}
            onEditorModelChange={onEditorModelChange}
            onModelChange={onModelChange}
            referencePreviewCache={referencePreviewCache}
            sources={sources}
            tableBlockId={tableBlockId}
            textBlock={textBlock}
            workbookEnabled={workbookEnabled}
            workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
          />
        </InspectorSection>
      ) : inputBlock ? (
        <AnswerCellSettings
          cell={cell}
          disabled={disabled}
          editorModel={editorModel}
          inputBlock={inputBlock}
          model={model}
          onEditorModelChange={onEditorModelChange}
          onModelChange={onModelChange}
          referencePreviewCache={referencePreviewCache}
          responseField={responseField}
          sources={sources}
          tableBlockId={tableBlockId}
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
      ) : null}
    </div>
  );
}

function ContentCellSettings({
  model,
  cell,
  textBlock,
  tableBlockId,
  editorModel,
  referencePreviewCache,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  disabled,
  onModelChange,
  onEditorModelChange,
}: {
  model: TableEditorModel;
  cell: TableEditorCell;
  textBlock: TableEditorTextBlock;
  tableBlockId: string;
  editorModel: ComposedEditorModel;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onEditorModelChange(model: ComposedEditorModel): void;
}) {
  return (
    <TextAuthoringContent
      content={textBlock.content}
      disabled={disabled}
      model={editorModel}
      onChange={(content) =>
        onModelChange(
          updateTableCellTextBlockContent(
            model,
            cell.id,
            textBlock.id,
            content,
          ),
        )
      }
      onCreatedReference={({ nextModel, nextContent }) => {
        onEditorModelChange(
          updateTableContentCellInlineContentInComposedModel({
            cellBlockId: textBlock.id,
            cellId: cell.id,
            content: nextContent,
            editorModel: nextModel,
            tableBlockId,
          }),
        );
      }}
      onModelChange={onEditorModelChange}
      onSelectReference={() => undefined}
      referencePreviewCache={referencePreviewCache}
      sources={sources}
      workbookEnabled={workbookEnabled}
      workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
    />
  );
}

function AnswerCellSettings({
  model,
  cell,
  inputBlock,
  tableBlockId,
  editorModel,
  responseField,
  referencePreviewCache,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  disabled,
  onModelChange,
  onEditorModelChange,
}: {
  model: TableEditorModel;
  cell: TableEditorCell;
  inputBlock: TableEditorInputBlock;
  tableBlockId: string;
  editorModel: ComposedEditorModel;
  responseField: TableResponseField | null | undefined;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onEditorModelChange(model: ComposedEditorModel): void;
}) {
  if (!responseField) {
    return (
      <div className="grid gap-5">
        <section className="grid gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <div className="grid gap-1">
            <h4 className="text-sm font-medium text-destructive">
              Missing answer field
            </h4>
            <p className="text-xs text-muted-foreground">
              This answer cell lost its matching field. Repair it to continue
              editing.
            </p>
          </div>
          <Button
            disabled={disabled}
            onClick={() =>
              onModelChange(repairMissingAnswerFieldForCell(model, cell.id))
            }
            type="button"
            variant="outline"
          >
            Repair answer field
          </Button>
        </section>
      </div>
    );
  }

  const input = normalizeInputPrimitiveForType(
    inputBlock.input,
    responseField.type,
  );

  return (
    <div className="grid gap-5">
      <InspectorSection title="Input">
        <AnswerFieldSettings
          disabled={disabled}
          label={inputBlock.label}
          onLabelChange={(label) =>
            onModelChange(
              updateTableCell(model, cell.id, (current) =>
                updatePrimaryInputBlock(current, (block) => ({
                  ...block,
                  label,
                })),
              ),
            )
          }
          onPlaceholderChange={(placeholder) =>
            onModelChange(
              updateTableCell(model, cell.id, (current) =>
                updatePrimaryInputBlock(current, (block) => ({
                  ...block,
                  placeholder,
                })),
              ),
            )
          }
          onRequiredChange={(required) => {
            onModelChange(
              updateTableCell(model, cell.id, (current) =>
                updatePrimaryInputBlock(current, (block) => ({
                  ...block,
                  input: setInputPrimitiveRequired(input, required),
                })),
              ),
            );
          }}
          onResponseFieldChange={(field) => {
            const nextModel = updateResponseFieldForCell(
              model,
              cell.id,
              () => field,
            );
            onModelChange(
              updateTableCell(nextModel, cell.id, (current) =>
                updatePrimaryInputBlock(current, (block) => ({
                  ...block,
                  input: normalizeInputPrimitiveForType(
                    block.input,
                    field.type,
                  ),
                })),
              ),
            );
          }}
          placeholder={inputBlock.placeholder}
          required={deriveResponseFieldRequiredFromInput(input) === true}
          responseField={responseField}
        />
        <InputPrimitiveSettings
          disabled={disabled}
          input={input}
          onInputChange={(input) =>
            onModelChange(
              updateTableCell(model, cell.id, (current) =>
                updatePrimaryInputBlock(current, (block) => ({
                  ...block,
                  input,
                })),
              ),
            )
          }
        />
      </InspectorSection>

      <InspectorSection title="Scoring">
        <GradingSettings
          blockId={cell.id}
          disabled={disabled}
          grading={inputBlock.grading}
          onGradingChange={(grading) =>
            onModelChange(
              updateTableCell(model, cell.id, (current) =>
                updatePrimaryInputBlock(current, (block) =>
                  applyInputGrading(block, grading),
                ),
              ),
            )
          }
          onPointsChange={(points) =>
            onModelChange(
              updateTableCell(model, cell.id, (current) =>
                updatePrimaryInputBlock(current, (block) => ({
                  ...block,
                  points,
                })),
              ),
            )
          }
          points={inputBlock.points}
        />
      </InspectorSection>

      {requiresCorrectValueSource(inputBlock.grading) ? (
        <InspectorSection title="Correct answer">
          <CorrectAnswerSettings
            disabled={disabled}
            model={editorModel}
            onChange={(valueSource) =>
              onModelChange(
                updateTableCellInputBlockCorrectValueSource(
                  model,
                  cell.id,
                  inputBlock.id,
                  valueSource,
                ),
              )
            }
            onCreatedReference={({ nextModel, referenceId }) => {
              onEditorModelChange(
                updateTableCellValueInComposedModel({
                  cellBlockId: inputBlock.id,
                  cellId: cell.id,
                  editorModel: nextModel,
                  tableBlockId,
                  value: {
                    referenceId,
                    type: "reference",
                  },
                }),
              );
            }}
            onModelChange={onEditorModelChange}
            referencePreviewCache={referencePreviewCache}
            sources={sources}
            value={
              inputBlock.correctValueSource ?? createDefaultCorrectValueSource()
            }
            valueType={responseField.type}
            workbookEnabled={workbookEnabled}
            workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
          />
        </InspectorSection>
      ) : null}
    </div>
  );
}

function updatePrimaryInputBlock(
  cell: TableEditorCell,
  update: (block: TableEditorInputBlock) => TableEditorInputBlock,
): TableEditorCell {
  let updated = false;
  return {
    ...cell,
    blocks: getTableCellPrimitiveBlocks(cell).map((block) => {
      if (!updated && block.type === "input") {
        updated = true;
        return update(block);
      }
      return block;
    }),
  };
}
