import { signIn } from "#/features/auth";
import {
  AccessDeniedPage,
  SignInRequiredPage,
  UnexpectedErrorPage,
} from "#/features/errors";
import {
  getApiErrorRequestId,
  isForbiddenError,
  isUnauthorizedError,
} from "#/lib/errors/api-error";
import { PageContainer } from "#/components/patterns";
import {
  SavedBlueprintChooserDialog,
  SourceChooserDialog,
  UploadSourceDialog,
} from "./create-page-dialogs";
import {
  BlankBlueprintPanel,
  CreateHeroSection,
  SavedBlueprintPanel,
  SourceBlueprintPanel,
} from "./create-page-sections";
import { useCreatePageController } from "./use-create-page-controller";

export function CreatePage() {
  const controller = useCreatePageController();

  if (isUnauthorizedError(controller.initialError)) {
    return (
      <SignInRequiredPage
        onSignIn={() => {
          void signIn();
        }}
      />
    );
  }
  if (isForbiddenError(controller.initialError)) {
    return (
      <AccessDeniedPage
        description="You do not have access to create a blueprint."
        requestId={getApiErrorRequestId(controller.initialError)}
      />
    );
  }
  if (controller.initialError) {
    return (
      <UnexpectedErrorPage
        description="Blueprint options could not be loaded."
        requestId={getApiErrorRequestId(controller.initialError)}
      />
    );
  }

  return (
    <>
      <PageContainer variant="launcher">
        <CreateHeroSection hero={controller.viewModel.hero} />
        <BlankBlueprintPanel
          blankBlueprint={controller.viewModel.blankBlueprint}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <SavedBlueprintPanel
            savedBlueprints={controller.viewModel.savedBlueprints}
            isLoading={controller.isBlueprintsLoading}
            errorMessage={controller.blueprintsErrorMessage}
            onChoose={() =>
              controller.savedBlueprintChooser.onOpenChange(true)
            }
            onRetry={controller.onRetryBlueprints}
          />
          <SourceBlueprintPanel
            sourceBackedBlueprint={controller.viewModel.sourceBackedBlueprint}
            isLoading={controller.isSourcesLoading}
            errorMessage={controller.sourcesErrorMessage}
            onChoose={() => controller.sourceChooser.onOpenChange(true)}
            onUpload={() => controller.uploadSourceDialog.onOpenChange(true)}
            onRetry={controller.onRetrySources}
          />
        </div>
      </PageContainer>

      <SavedBlueprintChooserDialog
        controller={controller.savedBlueprintChooser}
      />
      <SourceChooserDialog controller={controller.sourceChooser} />
      <UploadSourceDialog
        open={controller.uploadSourceDialog.open}
        onOpenChange={controller.uploadSourceDialog.onOpenChange}
        onCreated={controller.uploadSourceDialog.onCreated}
      />
    </>
  );
}
