import { QueryClient } from "@tanstack/react-query";
import {
  isForbiddenError,
  isNotFoundError,
  isUnauthorizedError,
} from "#/lib/errors/api-error";

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: (failureCount, error) => {
          if (
            isUnauthorizedError(error) ||
            isForbiddenError(error) ||
            isNotFoundError(error)
          ) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });

  return {
    queryClient,
  };
}
