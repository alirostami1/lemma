import { AsyncPanel } from "@lemma/ui/components/async-panel";
import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import {
  ResourceList,
  ResourceListItem,
} from "@lemma/ui/components/resource-list";
import { FileSpreadsheet, Upload } from "lucide-react";
import type { Workbook } from "#/domains/workbooks/model";

export function SourcePickerDialog({
  open,
  sources,
  isLoading,
  errorMessage,
  onOpenChange,
  onSelectSource,
  onUploadSource,
}: {
  open: boolean;
  sources: Workbook[];
  isLoading: boolean;
  errorMessage: string | null;
  onOpenChange(open: boolean): void;
  onSelectSource(workbookId: string): void;
  onUploadSource(): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose source</DialogTitle>
          <DialogDescription>
            Select a source to use for references.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <AsyncPanel
            isLoading={isLoading}
            errorMessage={errorMessage}
            isEmpty={sources.length === 0}
            loading={
              <p className="text-sm text-muted-foreground">
                Loading sources...
              </p>
            }
            error={(message) => <InlineError message={message} />}
            empty={
              <EmptyState
                description="No ready sources yet."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onUploadSource}
                  >
                    <Upload />
                    Upload source
                  </Button>
                }
              />
            }
          >
            <ResourceList>
              {sources.map((source) => (
                <ResourceListItem
                  key={source.id}
                  variant="display"
                  title={source.name}
                  metadata={
                    source.originalName
                      ? `Ready source | ${source.originalName}`
                      : "Ready source"
                  }
                  trailingAction={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectSource(source.id)}
                    >
                      <FileSpreadsheet />
                      Select
                    </Button>
                  }
                />
              ))}
            </ResourceList>
          </AsyncPanel>
          {errorMessage && sources.length > 0 ? (
            <InlineError message={errorMessage} />
          ) : null}
          {sources.length > 0 ? (
            <Button type="button" variant="outline" onClick={onUploadSource}>
              <Upload />
              Upload source
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
