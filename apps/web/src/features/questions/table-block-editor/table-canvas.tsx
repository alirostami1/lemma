import { cn } from "@lemma/ui/lib/utils";
import type { TableEditorModel } from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { TableCellView } from "./table-cell-view";
import { ensureTableCell, getTableCellAt } from "./table-editor-operations";
import type { TableEditorSelection } from "./table-selection";
import { isTableSelectionEqual } from "./table-selection";

export function TableCanvas({
  model,
  selection,
  referencePreviewCache,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: TableEditorModel;
  selection: TableEditorSelection;
  referencePreviewCache?: ReferencePreviewCache;
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onSelectionChange(selection: TableEditorSelection): void;
}) {
  return (
    <div
      className="group relative overflow-auto p-3 transition"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          onSelectionChange({ type: "table" });
        }
      }}
    >
      <table className="w-full min-w-max border-separate border-spacing-2">
        {model.showColumnNames ? (
          <thead>
            <tr>
              {model.showRowNames ? <th className="w-32" /> : null}
              {model.columns.map((column) => (
                <th key={column.id} className="min-w-40">
                  <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                      "w-full rounded-md border border-border/70 bg-background px-3 py-2 text-left text-sm font-medium transition hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring",
                      isTableSelectionEqual(selection, {
                        type: "column",
                        columnId: column.id,
                      }) && "border-primary ring-2 ring-primary/20",
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectionChange({
                        type: "column",
                        columnId: column.id,
                      });
                    }}
                  >
                    {column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
        ) : null}

        <tbody>
          {model.rows.map((row) => (
            <tr key={row.id}>
              {model.showRowNames ? (
                <th className="w-32 align-top">
                  <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                      "w-full rounded-md border border-border/70 bg-background px-3 py-2 text-left text-sm font-medium transition hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring",
                      isTableSelectionEqual(selection, {
                        type: "row",
                        rowId: row.id,
                      }) && "border-primary ring-2 ring-primary/20",
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectionChange({ type: "row", rowId: row.id });
                    }}
                  >
                    {row.label}
                  </button>
                </th>
              ) : null}

              {model.columns.map((column) => {
                const cell = getTableCellAt(model, row.id, column.id);
                const responseField =
                  cell?.type === "response"
                    ? model.responseFields.find(
                        (field) => field.id === cell.responseFieldId,
                      )
                    : undefined;
                const isSelected =
                  cell !== null &&
                  isTableSelectionEqual(selection, {
                    type: "cell",
                    cellId: cell.id,
                  });

                return (
                  <td key={column.id} className="min-w-40 align-top">
                    <TableCellView
                      cell={cell}
                      responseField={responseField}
                      referencePreviewCache={referencePreviewCache ?? {}}
                      isSelected={isSelected}
                      disabled={disabled}
                      onSelect={() => {
                        const result = ensureTableCell(
                          model,
                          row.id,
                          column.id,
                        );
                        if (result.model !== model) onModelChange(result.model);
                        onSelectionChange({
                          type: "cell",
                          cellId: result.cell.id,
                        });
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
