import { QueryClient } from "@tanstack/react-query";
import {
  isForbiddenError,
  isNotFoundError,
  isUnauthorizedError,
} from "#/lib/errors/api-error";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
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
      mutations: {
        retry: false,
      },
    },
  });
}
