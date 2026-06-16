import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuestionBlueprintsQuery } from "#/domains/questions/hooks";
import { useWorkbooksQuery } from "#/domains/workbooks/hooks";
import type { Workbook } from "#/domains/workbooks/model";
import { notifySourceUploaded } from "#/features/notifications";
import {
  isForbiddenError,
  isUnauthorizedError,
} from "#/lib/errors/api-error";
import type {
  SavedBlueprintChooserController,
  SourceChooserController,
} from "./create-chooser-controller";
import {
  buildCreatePageViewModel,
  CREATE_RECENT_ITEM_LIMIT,
  type CreatePageViewModel,
} from "./create-page-view-model";
import { useSavedBlueprintChooserController } from "./use-saved-blueprint-chooser-controller";
import { useSourceChooserController } from "./use-source-chooser-controller";

export type CreatePageController = {
  viewModel: CreatePageViewModel;
  isBlueprintsLoading: boolean;
  isSourcesLoading: boolean;
  initialError: Error | null;
  blueprintsErrorMessage: string | null;
  sourcesErrorMessage: string | null;
  onRetryBlueprints(): void;
  onRetrySources(): void;
  savedBlueprintChooser: SavedBlueprintChooserController;
  sourceChooser: SourceChooserController;
  uploadSourceDialog: {
    open: boolean;
    onOpenChange(open: boolean): void;
    onCreated(source: Workbook): Promise<void>;
  };
};

export function useCreatePageController(): CreatePageController {
  const navigate = useNavigate();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const blueprintsQuery = useQuestionBlueprintsQuery({
    limit: CREATE_RECENT_ITEM_LIMIT,
    status: "active",
  });
  const sourcesQuery = useWorkbooksQuery({
    limit: CREATE_RECENT_ITEM_LIMIT,
    status: "valid",
  });
  const savedBlueprintChooser = useSavedBlueprintChooserController();
  const sourceChooser = useSourceChooserController({
    onUploadSource: () => setIsUploadDialogOpen(true),
  });
  const blueprints = blueprintsQuery.data?.questionBlueprints ?? [];
  const sources = sourcesQuery.data?.workbooks ?? [];
  const viewModel = useMemo(
    () => buildCreatePageViewModel({ blueprints, sources }),
    [blueprints, sources],
  );
  const accessError = [blueprintsQuery.error, sourcesQuery.error].find(
    (error) => isUnauthorizedError(error) || isForbiddenError(error),
  );

  return {
    viewModel,
    isBlueprintsLoading: blueprintsQuery.isLoading,
    isSourcesLoading: sourcesQuery.isLoading,
    initialError:
      accessError ??
      (!blueprintsQuery.isLoading &&
      !sourcesQuery.isLoading &&
      blueprintsQuery.isError &&
      sourcesQuery.isError
        ? (blueprintsQuery.error ?? sourcesQuery.error)
        : null),
    blueprintsErrorMessage: blueprintsQuery.isError
      ? "Some blueprints could not be loaded."
      : null,
    sourcesErrorMessage: sourcesQuery.isError
      ? "Some sources could not be loaded."
      : null,
    onRetryBlueprints: () => {
      void blueprintsQuery.refetch();
    },
    onRetrySources: () => {
      void sourcesQuery.refetch();
    },
    savedBlueprintChooser,
    sourceChooser,
    uploadSourceDialog: {
      open: isUploadDialogOpen,
      onOpenChange: setIsUploadDialogOpen,
      onCreated: async (source) => {
        notifySourceUploaded({
          context: "create",
          sourceName: source.name,
        });
        setIsUploadDialogOpen(false);
        await navigate({
          to: "/studio",
          search: { workbookId: source.id },
        });
      },
    },
  };
}
