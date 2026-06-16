import {
  BrowserApiError,
  type BrowserApiErrorInput,
  type ApiErrorPayload,
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
