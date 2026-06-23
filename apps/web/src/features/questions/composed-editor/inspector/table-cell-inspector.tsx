import { Button } from "@lemma/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import type {
  ComposedEditorModel,
  TableEditorCell,
  TableEditorModel,
  TableResponseField,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  makeContentCell,
  makeResponseCell,
  repairMissingAnswerFieldForCell,
  updateContentCellContent,
  updateResponseCellCorrectValueSource,
  updateResponseFieldForCell,
  updateTableCell,
} from "#/features/questions/table-block-editor";
import {
  AnswerFieldSettings,
  CorrectAnswerSettings,
  GradingSettings,
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
  const { cell, context, responseField, title } = viewModel;

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
            value={cell.type}
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
      {cell.type === "content" ? (
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
            workbookEnabled={workbookEnabled}
            workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
          />
        </InspectorSection>
      ) : (
        <AnswerCellSettings
          cell={cell}
          disabled={disabled}
          editorModel={editorModel}
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
      )}
    </div>
  );
}

function ContentCellSettings({
  model,
  cell,
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
  cell: Extract<TableEditorCell, { type: "content" }>;
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
      content={cell.content}
      disabled={disabled}
      model={editorModel}
      onChange={(content) =>
        onModelChange(updateContentCellContent(model, cell.id, content))
      }
      onCreatedReference={({ nextModel, nextContent }) => {
        onEditorModelChange(
          updateTableContentCellInlineContentInComposedModel({
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
  cell: Extract<TableEditorCell, { type: "response" }>;
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
  return (
    <div className="grid gap-5">
      {!responseField ? (
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
      ) : null}
      {responseField ? (
        <>
          <InspectorSection title="Input">
            <AnswerFieldSettings
              disabled={disabled}
              label={cell.label}
              onLabelChange={(label) =>
                onModelChange(
                  updateTableCell(model, cell.id, (current) =>
                    current.type === "response"
                      ? { ...current, label }
                      : current,
                  ),
                )
              }
              onPlaceholderChange={(placeholder) =>
                onModelChange(
                  updateTableCell(model, cell.id, (current) =>
                    current.type === "response"
                      ? { ...current, placeholder }
                      : current,
                  ),
                )
              }
              onResponseFieldChange={(field) =>
                onModelChange(
                  updateResponseFieldForCell(model, cell.id, () => field),
                )
              }
              placeholder={cell.placeholder}
              responseField={responseField}
            />
          </InspectorSection>

          <InspectorSection title="Scoring">
            <GradingSettings
              blockId={cell.id}
              disabled={disabled}
              grading={cell.grading}
              onGradingChange={(grading) =>
                onModelChange(
                  updateTableCell(model, cell.id, (current) =>
                    current.type === "response"
                      ? { ...current, grading }
                      : current,
                  ),
                )
              }
              onPointsChange={(points) =>
                onModelChange(
                  updateTableCell(model, cell.id, (current) =>
                    current.type === "response"
                      ? { ...current, points }
                      : current,
                  ),
                )
              }
              points={cell.points}
            />
          </InspectorSection>

          <InspectorSection title="Correct answer">
            <CorrectAnswerSettings
              disabled={disabled}
              model={editorModel}
              onChange={(valueSource) =>
                onModelChange(
                  updateResponseCellCorrectValueSource(
                    model,
                    cell.id,
                    valueSource,
                  ),
                )
              }
              onCreatedReference={({ nextModel, referenceId }) => {
                onEditorModelChange(
                  updateTableCellValueInComposedModel({
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
              value={cell.correctValueSource}
              valueType={responseField.type}
              workbookEnabled={workbookEnabled}
              workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
            />
          </InspectorSection>
        </>
      ) : null}
    </div>
  );
}
