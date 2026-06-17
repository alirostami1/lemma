import { Input } from "@lemma/ui/components/input";
import { useMemo } from "react";
import type {
  TableAnswerValue,
  TableBlockPreviewModel,
  TableBlockPreviewProps,
  TableResponseField,
} from "#/domains/questions/authoring";
import {
  coerceAnswerValue,
  formatAnswerInputValue,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { InlineContentRenderer } from "#/features/questions/editor-shared";

type TableBlockPreviewWithReferencesProps = TableBlockPreviewProps & {
  referencePreviewCache?: ReferencePreviewCache;
};

export function TableBlockPreview({
  model,
  answer,
  referencePreviewCache,
  onAnswerChange,
  disabled,
  showPrompt = true,
}: TableBlockPreviewWithReferencesProps) {
  const cellGrid = useMemo(() => createViewCellGrid(model), [model]);
  const responseFieldsById = useMemo(
    () => new Map(model.responseFields.map((field) => [field.id, field])),
    [model.responseFields],
  );

  return (
    <div className="space-y-3">
      {showPrompt && model.prompt ? (
        <p className="text-sm font-medium">{model.prompt}</p>
      ) : null}
      <div className="overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b">
              {model.showRowNames ? (
                <th className="w-36 px-2 py-2 text-left font-medium text-muted-foreground">
                  #
                </th>
              ) : null}
              {model.columns.map((column) => (
                <th
                  key={column.id}
                  className="min-w-28 px-2 py-2 text-left font-medium"
                >
                  {model.showColumnNames ? column.label : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                {model.showRowNames ? (
                  <th className="bg-muted/20 px-2 py-2 text-left font-medium">
                    {row.label}
                  </th>
                ) : null}
                {model.columns.map((column) => {
                  const cell = cellGrid.get(`${row.id}:${column.id}`);
                  if (!cell) {
                    return <td key={column.id} className="px-2 py-2" />;
                  }
                  if (cell.type === "content") {
                    return (
                      <td key={cell.id} className="px-2 py-2">
                        {cell.content.length > 0 ? (
                          <InlineContentRenderer
                            content={cell.content}
                            mode="preview"
                            referencePreviewValues={referencePreviewCache ?? {}}
                          />
                        ) : (
                          <span className="text-muted-foreground">Empty</span>
                        )}
                      </td>
                    );
                  }
                  const field = responseFieldsById.get(cell.responseFieldId);
                  const currentAnswer = answer[cell.responseFieldId];
                  return (
                    <td key={cell.id} className="px-2 py-2">
                      <TableAnswerInput
                        rowLabel={row.label}
                        columnLabel={column.label}
                        field={field}
                        value={currentAnswer}
                        disabled={disabled}
                        onChange={(nextValue) =>
                          onAnswerChange({
                            ...answer,
                            [cell.responseFieldId]: nextValue,
                          })
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function createViewCellGrid(model: TableBlockPreviewModel) {
  return new Map(
    model.cells.map((cell) => [`${cell.rowId}:${cell.columnId}`, cell]),
  );
}

function TableAnswerInput({
  rowLabel,
  columnLabel,
  field,
  value,
  disabled,
  onChange,
}: {
  rowLabel: string;
  columnLabel: string;
  field?: TableResponseField;
  value: TableAnswerValue | undefined;
  disabled?: boolean;
  onChange(value: TableAnswerValue): void;
}) {
  const label = field?.label
    ? `${field.label} (${rowLabel}, ${columnLabel})`
    : `Answer for ${rowLabel}, ${columnLabel}`;
  return (
    <div className="grid gap-1">
      <Input
        id={field?.id ?? makeFallbackInputId(rowLabel, columnLabel)}
        name={field?.id}
        type="text"
        inputMode={field?.type === "number" ? "decimal" : undefined}
        aria-label={label}
        disabled={disabled}
        value={value == null ? "" : formatAnswerInputValue(value)}
        onChange={(event) =>
          onChange(coerceAnswerValue(event.currentTarget.value, field))
        }
      />
    </div>
  );
}

function makeFallbackInputId(rowLabel: string, columnLabel: string) {
  return `${rowLabel}-${columnLabel}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
}
