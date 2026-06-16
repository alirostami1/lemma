import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@lemma/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import { FileQuestion, Plus } from "lucide-react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioReadiness } from "../../studio/studio-readiness";
import type { EditorSelection } from "../editor-selection";
import {
  type InsertComposedBlockType,
  insertComposedBlock,
} from "../composed-editor-operations";

export function DocumentInspector({
  model,
  readiness,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: ComposedEditorModel;
  readiness?: StudioReadiness;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
}) {
  return (
    <div className="grid gap-4">
      <CardHeader className="gap-3 p-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion className="size-4" />
            Document
          </CardTitle>
          <CardDescription>Add blocks and check question settings.</CardDescription>
        </div>
      </CardHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>Add block</FieldLabel>
          <FieldDescription>Insert a new block at the end.</FieldDescription>
          <AddBlockSelect
            disabled={disabled}
            onAdd={(type) => {
              const next = insertComposedBlock({
                model,
                type,
              });
              onModelChange(next.model);
              onSelectionChange(next.selection);
            }}
          />
        </Field>
      </FieldGroup>
      <div className="rounded-md border bg-muted/20 p-3">
        <p className="text-sm font-medium">Readiness</p>
        <p className="text-xs text-muted-foreground">
          {readiness?.issues.length
            ? `${readiness.issues.length} item${readiness.issues.length === 1 ? "" : "s"} to fix.`
            : "Ready to save and generate."}
        </p>
        {readiness?.issues.length ? (
          <ul className="mt-3 grid gap-2 text-xs text-muted-foreground">
            {readiness.issues.slice(0, 4).map((issue) => (
              <li key={issue.id}>{issue.message}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function AddBlockSelect({
  disabled,
  onAdd,
}: {
  disabled?: boolean;
  onAdd(type: InsertComposedBlockType): void;
}) {
  return (
    <Select
      disabled={disabled}
      value=""
      onValueChange={(value) => {
        if (
          value === "text" ||
          value === "rich_text" ||
          value === "response" ||
          value === "table" ||
          value === "separator"
        ) {
          onAdd(value);
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Choose block type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="text">
          <span className="flex items-center gap-2">
            <Plus className="size-4" />
            Text
          </span>
        </SelectItem>
        <SelectItem value="rich_text">Rich text</SelectItem>
        <SelectItem value="response">Answer</SelectItem>
        <SelectItem value="table">Table</SelectItem>
        <SelectItem value="separator">Separator</SelectItem>
      </SelectContent>
    </Select>
  );
}
