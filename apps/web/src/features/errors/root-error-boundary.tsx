import type { ErrorComponentProps } from "@tanstack/react-router";
import { signIn } from "#/features/auth";
import {
  AccessDeniedPage,
  NotFoundPage,
  SignInRequiredPage,
  UnexpectedErrorPage,
} from "./error-pages";
import { buildRouteErrorViewModel } from "./route-error-view-model";

export function RootErrorBoundary({ error, reset }: ErrorComponentProps) {
  const viewModel = buildRouteErrorViewModel(error);

  switch (viewModel.kind) {
    case "sign_in_required":
      return (
        <SignInRequiredPage
          title={viewModel.title}
          description={viewModel.description}
          onSignIn={() => {
            void signIn();
          }}
        />
      );
    case "forbidden":
      return (
        <AccessDeniedPage
          title={viewModel.title}
          description={viewModel.description}
          requestId={viewModel.requestId}
        />
      );
    case "not_found":
      return (
        <NotFoundPage
          title={viewModel.title}
          description={viewModel.description}
        />
      );
    case "unexpected":
      return (
        <UnexpectedErrorPage
          title={viewModel.title}
          description={viewModel.description}
          requestId={viewModel.requestId}
          reset={reset}
        />
      );
  }
}
