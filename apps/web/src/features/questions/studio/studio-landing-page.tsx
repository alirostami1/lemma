import { Button } from "@lemma/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { useNavigate } from "@tanstack/react-router";
import { FilePlus2, FolderOpen, PenLine } from "lucide-react";
import type { ReactNode } from "react";
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
            Choose how to start.
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Create a new draft, continue saved draft work, or open a published
            blueprint as an edit draft.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <StudioLandingAction
            description="Start an untargeted draft and move into the editor."
            icon={<FilePlus2 />}
            onClick={() =>
              void navigateToNewStudioDraft(navigate, { replace: false })
            }
            title="Create new blueprint"
          />
          <StudioLandingAction
            description="Pick from recent server drafts."
            icon={<FolderOpen />}
            onClick={() => setIsOpenDialogOpen(true)}
            title="Continue draft"
          />
          <StudioLandingAction
            description="Pick a published blueprint and resume or create an edit draft."
            icon={<PenLine />}
            onClick={() => setIsOpenDialogOpen(true)}
            title="Edit published blueprint"
          />
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

function StudioLandingAction({
  description,
  icon,
  onClick,
  title,
}: {
  description: string;
  icon: ReactNode;
  onClick(): void;
  title: string;
}) {
  return (
    <Card className="h-full bg-background/90">
      <CardHeader className="gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="grid gap-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Button className="w-full" onClick={onClick} type="button">
          {title}
        </Button>
      </CardContent>
    </Card>
  );
}
