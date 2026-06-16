import { createBrowserApiClient } from "@lemma/http/browser";
import { AppApiError } from "#/api/errors";
import { env } from "#/env";
import { getOidc } from "./oidc";

const apiClient = createBrowserApiClient({
  baseUrl: () => env.LEMMA_ADMIN_API_URL,
  createError: (input) => new AppApiError(input),
  getAccessToken: async () => {
    const oidc = await getOidc();
    if (!oidc.isUserLoggedIn) {
      return null;
    }
    return oidc.getAccessToken();
  },
});

export const authedFetch = apiClient.request;
