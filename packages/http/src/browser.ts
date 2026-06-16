export type ApiErrorPayload = {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};

export type BrowserApiErrorInput = {
  status: number;
  headers: Headers;
  body: unknown;
  payload: ApiErrorPayload;
};

export class BrowserApiError extends Error {
  readonly status: number;
  readonly headers: Headers;
  readonly body: unknown;
  readonly payload: ApiErrorPayload;

  constructor(input: BrowserApiErrorInput) {
    super(input.payload.message);
    this.name = "BrowserApiError";
    this.status = input.status;
    this.headers = input.headers;
    this.body = input.body;
    this.payload = input.payload;
  }
}

export type BrowserApiClientOptions<TError extends Error = BrowserApiError> = {
  baseUrl: string | (() => string);
  getAccessToken?: () =>
    | Promise<string | null | undefined>
    | string
    | null
    | undefined;
  createError?: (input: BrowserApiErrorInput) => TError;
  fetchFn?: typeof fetch;
};

export type BrowserApiClient<TError extends Error = BrowserApiError> = {
  request<T>(url: string, options?: RequestInit): Promise<T>;
  createError(input: BrowserApiErrorInput): TError;
};

export function createBrowserApiClient<TError extends Error = BrowserApiError>({
  baseUrl,
  getAccessToken,
  createError = (input) => new BrowserApiError(input) as unknown as TError,
  fetchFn = fetch,
}: BrowserApiClientOptions<TError>): BrowserApiClient<TError> {
  return {
    createError,
    async request<T>(url: string, options: RequestInit = {}): Promise<T> {
      const headers = new Headers(options.headers);
      const token = await getAccessToken?.();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetchFn(resolveUrl(readBaseUrl(baseUrl), url), {
        ...options,
        headers,
      });
      const body = await parseApiResponseBody(response);

      if (!response.ok) {
        throw createError({
          body,
          headers: response.headers,
          status: response.status,
          payload: toApiErrorPayload(body, response.status),
        });
      }

      return body as T;
    },
  };
}

export async function parseApiResponseBody(
  response: Response,
): Promise<unknown> {
  if ([204, 205, 304].includes(response.status)) {
    return undefined;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function toApiErrorPayload(
  body: unknown,
  status: number,
): ApiErrorPayload {
  if (isRecord(body) && isRecord(body.error)) {
    return {
      code:
        typeof body.error.code === "string"
          ? body.error.code
          : `HTTP_${status}`,
      message:
        typeof body.error.message === "string"
          ? body.error.message
          : `API request failed with status ${status}.`,
      requestId:
        typeof body.error.requestId === "string"
          ? body.error.requestId
          : undefined,
      details: body.error.details,
    };
  }

  if (isRecord(body) && typeof body.message === "string") {
    return {
      code: `HTTP_${status}`,
      message: body.message,
    };
  }

  if (typeof body === "string" && body.length > 0) {
    return {
      code: `HTTP_${status}`,
      message: body,
    };
  }

  return {
    code: `HTTP_${status}`,
    message: `API request failed with status ${status}.`,
  };
}

function readBaseUrl(baseUrl: string | (() => string)): string {
  return typeof baseUrl === "function" ? baseUrl() : baseUrl;
}

function resolveUrl(baseUrl: string, url: string): string {
  if (isAbsoluteUrl(url)) {
    return url;
  }
  return `${baseUrl.replace(/\/+$/u, "")}/${url.replace(/^\/+/u, "")}`;
}

function isAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z\d+\-.]*:\/\//iu.test(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
