import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { InlineError } from "@lemma/ui/components/inline-error";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@lemma/ui/components/tabs";
import { useMemo } from "react";
import { useWorkbooksInfiniteQuery } from "#/domains/workbooks/hooks";
import type { Workbook } from "#/domains/workbooks/model";
import { WorkbookUploadForm } from "#/features/workbooks";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";

export function StudioSourcePickerDialog({
  open,
  onOpenChange,
  sources,
  previewSourceId,
  onAttachExisting,
  onCreated,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
  onAttachExisting(workbook: Workbook): void;
  onCreated(workbook: Workbook): void | Promise<void>;
}) {
  const workbooksQuery = useWorkbooksInfiniteQuery(
    { limit: 100 },
    { enabled: open },
  );
  const workbooks = useMemo(
    () =>
      workbooksQuery.data?.pages
        .flatMap((page) => page.workbooks)
        .filter((workbook) => workbook.status !== "deleted") ?? [],
    [workbooksQuery.data],
  );
  const attachedWorkbookIds = useMemo(
    () => new Set(sources.map((source) => source.workbookId)),
    [sources],
  );
  const previewSource = useMemo(
    () =>
      previewSourceId
        ? sources.find((source) => source.sourceId === previewSourceId) ?? null
        : null,
    [previewSourceId, sources],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attach source</DialogTitle>
          <DialogDescription>
            {previewSource
              ? `Previewing ${previewSource.name}.`
              : "Choose existing workbook or upload a new source."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="existing" className="grid gap-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="m-0 grid gap-3">
            {workbooksQuery.isError && !workbooksQuery.data ? (
              <InlineError message="Workbooks could not be loaded." />
            ) : null}
            {workbooksQuery.isLoading && workbooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Loading workbooks...
              </p>
            ) : null}
            {!workbooksQuery.isLoading && workbooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No workbooks found.
              </p>
            ) : null}

            {workbooks.length > 0 ? (
              <div className="grid max-h-[42vh] gap-2 overflow-y-auto pr-1">
                {workbooks.map((workbook) => {
                  const alreadyAttached = attachedWorkbookIds.has(workbook.id);
                  return (
                    <Button
                      key={workbook.id}
                      type="button"
                      variant="outline"
                      className="h-auto justify-start py-3 text-left"
                      disabled={alreadyAttached}
                      onClick={() => onAttachExisting(workbook)}
                    >
                      <span className="grid min-w-0 gap-0.5">
                        <span className="truncate font-medium">
                          {workbook.name}
                        </span>
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          {workbook.originalName}
                          {alreadyAttached ? " · attached" : ""}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            ) : null}

            {workbooksQuery.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void workbooksQuery.fetchNextPage()}
                  disabled={workbooksQuery.isFetchingNextPage}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="upload" className="m-0">
            <WorkbookUploadForm
              onCreated={onCreated}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
