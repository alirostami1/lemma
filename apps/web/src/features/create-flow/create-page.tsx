import { PageContainer } from "#/components/patterns";
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
import { SavedBlueprintChooserDialog } from "./create-page-dialogs";
import {
  BlankBlueprintPanel,
  CreateHeroSection,
  SavedBlueprintPanel,
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
        <div className="grid gap-4">
          <SavedBlueprintPanel
            errorMessage={controller.blueprintsErrorMessage}
            isLoading={controller.isBlueprintsLoading}
            onChoose={() => controller.savedBlueprintChooser.onOpenChange(true)}
            onRetry={controller.onRetryBlueprints}
            savedBlueprints={controller.viewModel.savedBlueprints}
          />
        </div>
      </PageContainer>

      <SavedBlueprintChooserDialog
        controller={controller.savedBlueprintChooser}
      />
    </>
  );
}
