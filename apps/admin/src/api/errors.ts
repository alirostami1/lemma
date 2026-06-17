import {
  type ApiErrorPayload,
  BrowserApiError,
  type BrowserApiErrorInput,
  toApiErrorPayload,
} from "@lemma/http/browser";

export type { ApiErrorPayload };
export { toApiErrorPayload };

export class AppApiError extends BrowserApiError {
  constructor(input: BrowserApiErrorInput) {
    super(input);
    this.name = "AppApiError";
  }
}
