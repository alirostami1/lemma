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
          description={viewModel.description}
          onSignIn={() => {
            void signIn();
          }}
          title={viewModel.title}
        />
      );
    case "forbidden":
      return (
        <AccessDeniedPage
          description={viewModel.description}
          requestId={viewModel.requestId}
          title={viewModel.title}
        />
      );
    case "not_found":
      return (
        <NotFoundPage
          description={viewModel.description}
          title={viewModel.title}
        />
      );
    case "unexpected":
      return (
        <UnexpectedErrorPage
          description={viewModel.description}
          requestId={viewModel.requestId}
          reset={reset}
          title={viewModel.title}
        />
      );
  }
}
