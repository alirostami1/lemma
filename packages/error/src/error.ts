export type HttpStatusCode =
  | 100
  | 102
  | 103
  | 200
  | 201
  | 202
  | 203
  | 206
  | 207
  | 208
  | 226
  | 300
  | 301
  | 302
  | 303
  | 305
  | 306
  | 307
  | 308
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 421
  | 422
  | 423
  | 424
  | 425
  | 426
  | 428
  | 429
  | 431
  | 451
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505
  | 506
  | 507
  | 508
  | 510
  | 511
  | -1;

export type HttpErrorCode =
  | "BAD_REQUEST"
  | `${Uppercase<string>}_NOT_FOUND`
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "ACCESS_DENIED"
  | "VALIDATION_ERROR"
  | "INTERNAL_SERVER_ERROR"
  | Uppercase<string>;

export type HttpErrorResponse<C extends HttpErrorCode = HttpErrorCode> = {
  error: {
    code: C;
    message: string;
    requestId?: string;
    details?: unknown;
  };
};

export abstract class DomainError<
  Code extends Uppercase<string> = Uppercase<string>,
> extends Error {
  abstract readonly domainCode: Code;
  readonly details?: unknown;
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class AccessDeniedError extends DomainError {
  readonly domainCode = "ACCESS_DENIED";
  constructor() {
    super("Access denied.");
  }
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type ServiceResult<T, E extends DomainError> = Result<T, E>;

export const ok = <T>(value: T) => ({ ok: true, value }) as const;

export const err = <E>(error: E) => ({ error, ok: false }) as const;

export type HttpErrorMapping<
  EC extends HttpErrorCode,
  SC extends HttpStatusCode,
> = {
  code: EC;
  status: SC;
};

type DomainErrorCode<E extends DomainError> =
  E extends DomainError<infer Code> ? Code : never;

export type ErrorMapper<
  E extends DomainError,
  EC extends HttpErrorCode = HttpErrorCode,
  SC extends HttpStatusCode = HttpStatusCode,
> = Record<DomainErrorCode<E>, HttpErrorMapping<EC, SC>>;

type MapperValueFor<M, E extends DomainError> = M[Extract<
  E["domainCode"],
  keyof M
>];

type CodeFor<M, E extends DomainError> =
  MapperValueFor<M, E> extends { code: infer Code } ? Code : never;

type StatusFor<M, E extends DomainError> =
  MapperValueFor<M, E> extends { status: infer Status } ? Status : never;

export type HttpError<
  EC extends HttpErrorCode = HttpErrorCode,
  SC extends HttpStatusCode = HttpStatusCode,
> = {
  body: HttpErrorResponse<EC>;
  status: SC;
};

export function createHttpErrorHandler<
  const M extends Record<
    string,
    HttpErrorMapping<HttpErrorCode, HttpStatusCode>
  >,
>(mapper: M) {
  return <E extends DomainError<Extract<keyof M, Uppercase<string>>>>(
    error: E,
    requestId?: string,
  ): HttpError<
    CodeFor<M, E> & HttpErrorCode,
    StatusFor<M, E> & HttpStatusCode
  > => {
    const mapped = mapper[error.domainCode] as MapperValueFor<M, E>;

    return {
      body: {
        error: {
          code: mapped.code,
          details: error.details,
          message: error.message,
          requestId,
        },
      },
      status: mapped.status,
    } as HttpError<
      CodeFor<M, E> & HttpErrorCode,
      StatusFor<M, E> & HttpStatusCode
    >;
  };
}
