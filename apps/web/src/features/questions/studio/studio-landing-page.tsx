import { Button } from "@lemma/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { InlineError } from "@lemma/ui/components/inline-error";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Clock3, FilePlus2, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { PageContainer } from "#/components/patterns";
import { SavedBlueprintsDialog } from "./saved-blueprints-dialog";
import {
  navigateToNewStudioDraft,
  navigateToStudioBlueprint,
  navigateToStudioDraft,
} from "./studio-controller-helpers";
import { useSavedBlueprintsController } from "./use-saved-blueprints-controller";

export function StudioLandingPage() {
  const navigate = useNavigate();
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const savedBlueprints = useSavedBlueprintsController({
    onEditBlueprintAsDraft: (blueprint) => {
      void navigateToStudioBlueprint(navigate, blueprint.id, {
        replace: false,
      });
    },
    onOpenDraft: (draftId) => {
      void navigateToStudioDraft(navigate, draftId, { replace: false });
    },
  });

  return (
    <PageContainer className="pb-8" variant="workbench">
      <section className="grid gap-6 rounded-2xl border bg-gradient-to-br from-background via-muted/40 to-background p-6 shadow-sm sm:p-8">
        <div className="grid gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Blueprint Studio
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Pick up your blueprint work.
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Continue where you left off or start a new blueprint.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="h-full bg-background/90">
            <CardHeader className="gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clock3 />
              </div>
              <div className="grid gap-2">
                <CardTitle className="text-xl">
                  Continue where you left off
                </CardTitle>
                <CardDescription>
                  Open your latest unfinished work right away.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {savedBlueprints.isDraftsInitialLoading ? (
                <div className="grid gap-2 rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 font-medium">
                    <LoaderCircle className="size-4 animate-spin" />
                    Loading recent work...
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Looking for your latest unfinished work.
                  </p>
                </div>
              ) : savedBlueprints.draftsErrorMessage ? (
                <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
                  <InlineError
                    message={savedBlueprints.draftsErrorMessage}
                    onRetry={savedBlueprints.onRetry}
                  />
                </div>
              ) : savedBlueprints.latestDraft ? (
                <div className="grid gap-1 rounded-xl border bg-muted/30 p-4">
                  <p className="font-medium">
                    {savedBlueprints.latestDraft.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {savedBlueprints.latestDraft.lastEditedLabel}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {savedBlueprints.latestDraft.unpublishedChangesLabel}
                  </p>
                </div>
              ) : (
                <div className="grid gap-1 rounded-xl border border-dashed bg-muted/20 p-4">
                  <p className="font-medium">No unfinished work yet</p>
                  <p className="text-sm text-muted-foreground">
                    Start a new blueprint to begin.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="sm:flex-1"
                  disabled={
                    savedBlueprints.isDraftsInitialLoading ||
                    savedBlueprints.draftsErrorMessage !== null ||
                    !savedBlueprints.latestDraft
                  }
                  onClick={() => {
                    if (!savedBlueprints.latestDraft) {
                      return;
                    }
                    void navigateToStudioDraft(
                      navigate,
                      savedBlueprints.latestDraft.draftId,
                      { replace: false },
                    );
                  }}
                  type="button"
                >
                  Continue where you left off
                  <ArrowRight />
                </Button>
                <Button
                  className="sm:flex-1"
                  onClick={() => setIsOpenDialogOpen(true)}
                  type="button"
                  variant="outline"
                >
                  Browse older work
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full bg-background/90">
            <CardHeader className="gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FilePlus2 />
              </div>
              <div className="grid gap-2">
                <CardTitle className="text-xl">Start a new blueprint</CardTitle>
                <CardDescription>
                  Create a new blueprint and open Studio.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Start with a blank blueprint and keep working from there.
              </p>
              <Button
                className="sm:w-fit"
                onClick={() =>
                  void navigateToNewStudioDraft(navigate, { replace: false })
                }
                type="button"
              >
                Start a new blueprint
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <SavedBlueprintsDialog
        open={isOpenDialogOpen}
        {...savedBlueprints}
        blueprintAction={{
          ...savedBlueprints.blueprintAction,
          onEditAsDraft: (id) => {
            savedBlueprints.blueprintAction.onEditAsDraft(id);
            setIsOpenDialogOpen(false);
          },
        }}
        onOpenChange={setIsOpenDialogOpen}
        onOpenDraft={(id) => {
          savedBlueprints.onOpenDraft(id);
          setIsOpenDialogOpen(false);
        }}
      />
    </PageContainer>
  );
}
