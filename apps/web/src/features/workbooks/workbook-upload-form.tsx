import { Button } from "@lemma/ui/components/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@lemma/ui/components/field";
import { Input } from "@lemma/ui/components/input";
import { FileSpreadsheet, ArrowLeft, Upload } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { Workbook } from "#/domains/workbooks/model";
import { useWorkbookUploadController } from "./use-workbook-upload-controller";

export type WorkbookUploadFormProps = {
  onCreated?(workbook: Workbook): void | Promise<void>;
  submitLabel?: string;
  submitIcon?: ReactNode;
  cancelLabel?: string;
  cancelIcon?: ReactNode;
  onCancel?(): void;
};

export function WorkbookUploadForm({
  onCreated,
  submitLabel = "Create source",
  submitIcon,
  cancelLabel = "Cancel",
  cancelIcon,
  onCancel,
}: WorkbookUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controller = useWorkbookUploadController({
    cancelLabel,
    onCreated,
    submitLabel,
  });

  useEffect(() => {
    if (!controller.selectedFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [controller.selectedFile]);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await controller.onSubmit();
      }}
    >
      <FieldGroup>
        <Field data-invalid={controller.viewModel.nameError !== null}>
          <FieldLabel htmlFor="workbook-name">Source name</FieldLabel>
          <Input
            id="workbook-name"
            name="name"
            placeholder="Source name"
            value={controller.name}
            onChange={(event) => controller.onNameChange(event.currentTarget.value)}
          />
          {controller.viewModel.nameError ? (
            <FieldError>{controller.viewModel.nameError}</FieldError>
          ) : null}
        </Field>
      </FieldGroup>
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            <FileSpreadsheet className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">File</p>
            <p className="truncate text-sm text-muted-foreground">
              {controller.viewModel.selectedFileLabel ?? "No .xlsx selected"}
            </p>
            {controller.viewModel.helperText ? (
              <p className="truncate text-xs text-muted-foreground">
                {controller.viewModel.helperText}
              </p>
            ) : null}
          </div>
        </div>
        <input
          ref={fileInputRef}
          accept=".xlsx"
          className="hidden"
          type="file"
          onChange={(event) => {
            const nextFile = event.currentTarget.files?.[0] ?? null;
            const result = controller.onFileChange(nextFile);
            if (!result.accepted) {
              event.currentTarget.value = "";
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={controller.viewModel.isFileSelectDisabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload />
          Select .xlsx
        </Button>
      </div>
      {controller.viewModel.errorMessage ? (
        <p className="text-sm text-destructive">
          {controller.viewModel.errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={controller.viewModel.isCancelDisabled}
            onClick={onCancel}
            className="gap-2"
          >
            {cancelIcon ?? <ArrowLeft className="size-4" />}
            {controller.viewModel.cancelLabel}
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={controller.viewModel.isSubmitDisabled}
          className="gap-2"
        >
          {submitIcon}
          {controller.viewModel.submitLabel}
        </Button>
      </div>
    </form>
  );
}
