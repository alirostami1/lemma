import { Input } from "@lemma/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import { useMemo } from "react";
import type {
  InputPrimitivePreviewState,
  TableAnswerValue,
  TableBlockPreviewModel,
  TableBlockPreviewPrimitiveBlock,
  TableBlockPreviewProps,
  TableResponseField,
} from "#/domains/questions/authoring";
import {
  coerceAnswerValue,
  coerceInputPrimitiveValue,
  createDefaultPreviewInputPrimitive,
  formatAnswerInputValue,
  getInputPrimitiveEffectiveValue,
  getTablePreviewCellPrimitiveBlocks,
  validateInputPrimitiveValue,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { InlineContentRenderer } from "#/features/questions/editor-shared";
import { RichTextBlockRenderer } from "#/features/questions/presentation/rich-text-block-renderer";

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
                  className="min-w-28 px-2 py-2 text-left font-medium"
                  key={column.id}
                >
                  {model.showColumnNames ? column.label : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr className="border-b last:border-0" key={row.id}>
                {model.showRowNames ? (
                  <th className="bg-muted/20 px-2 py-2 text-left font-medium">
                    {row.label}
                  </th>
                ) : null}
                {model.columns.map((column) => {
                  const cell = cellGrid.get(`${row.id}:${column.id}`);
                  if (!cell) {
                    return <td className="px-2 py-2" key={column.id} />;
                  }
                  return (
                    <td className="space-y-2 px-2 py-2" key={cell.id}>
                      {getTablePreviewCellPrimitiveBlocks(cell).length > 0 ? (
                        getTablePreviewCellPrimitiveBlocks(cell).map(
                          (cellBlock) => (
                            <TableCellPrimitive
                              answer={answer}
                              block={cellBlock}
                              columnLabel={column.label}
                              disabled={disabled}
                              key={cellBlock.id}
                              onAnswerChange={onAnswerChange}
                              referencePreviewCache={
                                referencePreviewCache ?? {}
                              }
                              responseFieldsById={responseFieldsById}
                              rowLabel={row.label}
                            />
                          ),
                        )
                      ) : (
                        <span className="text-muted-foreground">Empty</span>
                      )}
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

function TableCellPrimitive({
  block,
  responseFieldsById,
  rowLabel,
  columnLabel,
  answer,
  referencePreviewCache,
  disabled,
  onAnswerChange,
}: {
  block: TableBlockPreviewPrimitiveBlock;
  responseFieldsById: ReadonlyMap<string, TableResponseField>;
  rowLabel: string;
  columnLabel: string;
  answer: TableBlockPreviewProps["answer"];
  referencePreviewCache: ReferencePreviewCache;
  disabled?: boolean;
  onAnswerChange: TableBlockPreviewProps["onAnswerChange"];
}) {
  if (block.type === "text") {
    return block.content.length > 0 ? (
      <InlineContentRenderer
        content={block.content}
        mode="preview"
        referencePreviewValues={referencePreviewCache}
      />
    ) : (
      <span className="text-muted-foreground">Empty</span>
    );
  }
  if (block.type === "rich_text") {
    return (
      <RichTextBlockRenderer
        content={block.content}
        referencePreviewCache={referencePreviewCache}
      />
    );
  }
  if (block.type === "separator") {
    return <hr className="border-border" />;
  }

  const field = responseFieldsById.get(block.responseFieldId);
  const currentAnswer = answer[block.responseFieldId];
  const explicitInput = block.inputState !== undefined;
  return (
    <TableAnswerInput
      columnLabel={columnLabel}
      disabled={disabled}
      explicitInput={explicitInput}
      field={field}
      inputState={
        block.inputState ?? {
          input: createDefaultPreviewInputPrimitive({
            required: true,
            type: field?.type ?? "text",
          }),
          status: "materialized",
        }
      }
      onChange={(nextValue) =>
        onAnswerChange({
          ...answer,
          [block.responseFieldId]: nextValue,
        })
      }
      rowLabel={rowLabel}
      value={currentAnswer}
    />
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
  explicitInput,
  inputState,
  value,
  disabled,
  onChange,
}: {
  rowLabel: string;
  columnLabel: string;
  field?: TableResponseField;
  explicitInput: boolean;
  inputState: InputPrimitivePreviewState;
  value: TableAnswerValue | undefined;
  disabled?: boolean;
  onChange(value: TableAnswerValue): void;
}) {
  const label = field?.label
    ? `${field.label} (${rowLabel}, ${columnLabel})`
    : `Answer for ${rowLabel}, ${columnLabel}`;
  const inputId = field?.id ?? makeFallbackInputId(rowLabel, columnLabel);
  const errorId = `${inputId}-error`;
  if (inputState.status === "unresolved_options") {
    const messageId = `${inputId}-options-message`;
    return (
      <div className="grid gap-1">
        <Select disabled value={undefined}>
          <SelectTrigger
            aria-describedby={messageId}
            aria-label={label}
            id={inputId}
          >
            <SelectValue placeholder={field?.label ?? "Choose an option"} />
          </SelectTrigger>
          <SelectContent />
        </Select>
        <p className="text-xs text-muted-foreground" id={messageId}>
          {inputState.message}
        </p>
      </div>
    );
  }

  const input = inputState.input;
  const effectiveValue = getInputPrimitiveEffectiveValue(input, value);
  const validation = validateInputPrimitiveValue(input, effectiveValue);
  return (
    <div className="grid gap-1">
      {input.type === "select" ? (
        <Select
          disabled={disabled}
          onValueChange={onChange}
          value={
            typeof effectiveValue === "string" && effectiveValue.length > 0
              ? effectiveValue
              : undefined
          }
        >
          <SelectTrigger
            aria-describedby={validation.valid ? undefined : errorId}
            aria-invalid={!validation.valid}
            aria-label={label}
            id={inputId}
          >
            <SelectValue placeholder={field?.label ?? "Answer"} />
          </SelectTrigger>
          <SelectContent>
            {(input.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label ?? option.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          aria-describedby={validation.valid ? undefined : errorId}
          aria-invalid={!validation.valid}
          aria-label={label}
          disabled={disabled}
          id={inputId}
          inputMode={input.type === "number" ? "decimal" : undefined}
          name={field?.id}
          onChange={(event) =>
            onChange(
              explicitInput
                ? coerceInputPrimitiveValue(event.currentTarget.value, input)
                : coerceAnswerValue(event.currentTarget.value, field),
            )
          }
          type="text"
          value={
            effectiveValue == null ? "" : formatAnswerInputValue(effectiveValue)
          }
        />
      )}
      {!validation.valid ? (
        <p className="text-xs text-destructive" id={errorId}>
          {validation.errors[0].message}
        </p>
      ) : null}
    </div>
  );
}

function makeFallbackInputId(rowLabel: string, columnLabel: string) {
  return `${rowLabel}-${columnLabel}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
}
