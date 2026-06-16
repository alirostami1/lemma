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
import {
  getTableCell,
  makeContentCell,
  makeResponseCell,
  repairMissingAnswerFieldForCell,
  updateContentCellContent,
  updateResponseCellCorrectValueSource,
  updateResponseFieldForCell,
  updateTableCell,
} from "#/features/questions/table-block-editor";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  updateTableCellValueInComposedModel,
  updateTableContentCellInlineContentInComposedModel,
} from "./table-cell-reference-operations";
import {
  AnswerFieldSettings,
  CorrectAnswerSettings,
  GradingSettings,
} from "../shared/answer-authoring-fields";
import { TextAuthoringContent } from "../shared/text-authoring-content";
import { InspectorField } from "./inspector-field";
import { InspectorSection } from "./inspector-section";

export function TableCellInspector({
  model,
  tableBlockId,
  cellId,
  editorModel,
  referencePreviewCache,
  workbookEnabled,
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
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onEditorModelChange(model: ComposedEditorModel): void;
}) {
  const cell = getTableCell(model, cellId);
  if (!cell) {
    return <p className="text-sm text-muted-foreground">Select a cell.</p>;
  }
  const row = model.rows.find((candidate) => candidate.id === cell.rowId);
  const column = model.columns.find(
    (candidate) => candidate.id === cell.columnId,
  );
  const cellContext = [row?.label, column?.label].filter(Boolean).join(" | ");

  const responseField =
    cell.type === "response"
      ? model.responseFields.find((field) => field.id === cell.responseFieldId)
      : null;

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="text-sm font-medium">
          {cell.type === "response"
            ? "Selected answer cell"
            : "Selected content cell"}
        </h3>
        {cellContext ? (
          <p className="text-xs text-muted-foreground">{cellContext}</p>
        ) : null}
      </div>
      <InspectorSection title="Cell">
        <InspectorField label="Type">
          <Select
            value={cell.type}
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
            model={model}
            cell={cell}
            tableBlockId={tableBlockId}
            editorModel={editorModel}
            referencePreviewCache={referencePreviewCache}
            workbookEnabled={workbookEnabled}
            disabled={disabled}
            onModelChange={onModelChange}
            onEditorModelChange={onEditorModelChange}
          />
        </InspectorSection>
      ) : (
        <AnswerCellSettings
          model={model}
          cell={cell}
          tableBlockId={tableBlockId}
          editorModel={editorModel}
          responseField={responseField}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          disabled={disabled}
          onModelChange={onModelChange}
          onEditorModelChange={onEditorModelChange}
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
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onEditorModelChange(model: ComposedEditorModel): void;
}) {
  return (
    <TextAuthoringContent
      content={cell.content}
      referencePreviewCache={referencePreviewCache}
      model={editorModel}
      workbookEnabled={workbookEnabled}
      disabled={disabled}
      onChange={(content) =>
        onModelChange(updateContentCellContent(model, cell.id, content))
      }
      onModelChange={onEditorModelChange}
      onSelectReference={() => undefined}
      onCreatedReference={({ nextModel, nextContent }) => {
        onEditorModelChange(
          updateTableContentCellInlineContentInComposedModel({
            editorModel: nextModel,
            tableBlockId,
            cellId: cell.id,
            content: nextContent,
          }),
        );
      }}
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
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onModelChange(repairMissingAnswerFieldForCell(model, cell.id))
            }
          >
            Repair answer field
          </Button>
        </section>
      ) : null}
      {responseField ? (
        <>
          <InspectorSection title="Input">
            <AnswerFieldSettings
              responseField={responseField}
              label={cell.label}
              placeholder={cell.placeholder}
              disabled={disabled}
              onResponseFieldChange={(field) =>
                onModelChange(
                  updateResponseFieldForCell(model, cell.id, () => field),
                )
              }
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
            />
          </InspectorSection>

          <InspectorSection title="Scoring">
            <GradingSettings
              blockId={cell.id}
              points={cell.points}
              grading={cell.grading}
              disabled={disabled}
              onPointsChange={(points) =>
                onModelChange(
                  updateTableCell(model, cell.id, (current) =>
                    current.type === "response"
                      ? { ...current, points }
                      : current,
                  ),
                )
              }
              onGradingChange={(grading) =>
                onModelChange(
                  updateTableCell(model, cell.id, (current) =>
                    current.type === "response"
                      ? { ...current, grading }
                      : current,
                  ),
                )
              }
            />
          </InspectorSection>

          <InspectorSection title="Correct answer">
            <CorrectAnswerSettings
              value={cell.correctValueSource}
              model={editorModel}
              referencePreviewCache={referencePreviewCache}
              valueType={responseField.type}
              workbookEnabled={workbookEnabled}
              disabled={disabled}
              onModelChange={onEditorModelChange}
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
                    editorModel: nextModel,
                    tableBlockId,
                    cellId: cell.id,
                    value: {
                      type: "reference",
                      referenceId,
                    },
                  }),
                );
              }}
            />
          </InspectorSection>
        </>
      ) : null}
    </div>
  );
}
