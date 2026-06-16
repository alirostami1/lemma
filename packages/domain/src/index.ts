export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type Timestamped = {
  createdAt: Date;
  updatedAt: Date;
};

export type OwnedResource = Timestamped & {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
};

export type OperationLineage = JsonObject & {
  requestId: string;
  correlationId: string;
  causationId: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidString(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function assertUuidString(
  value: string,
  fieldName: string,
  fail?: (message: string) => never,
): string {
  if (!isUuidString(value)) {
    const message = `${fieldName} must be a supported UUID string.`;
    if (fail) {
      fail(message);
    }
    throw new TypeError(message);
  }
  return value;
}

export function isUuidV7(value: string): boolean {
  return UUID_V7_PATTERN.test(value.trim());
}

export function assertUuidV7(
  value: string,
  fieldName: string,
  fail?: (message: string) => never,
): string {
  const normalized = value.trim();
  if (!isUuidV7(normalized)) {
    const message = `${fieldName} must be a valid UUIDv7.`;
    if (fail) {
      fail(message);
    }
    throw new TypeError(message);
  }
  return normalized;
}

export function operationLineage(input: {
  requestId: string;
  correlationId: string;
  causationId?: string | null;
}): OperationLineage {
  return {
    requestId: assertUuidString(input.requestId, "requestId"),
    correlationId: assertUuidString(input.correlationId, "correlationId"),
    causationId:
      input.causationId === undefined || input.causationId === null
        ? null
        : assertUuidString(input.causationId, "causationId"),
  };
}

export function rootOperationLineage(requestId: string): OperationLineage {
  const normalized = assertUuidString(requestId, "requestId");
  return {
    requestId: normalized,
    correlationId: normalized,
    causationId: null,
  };
}

export function childOperationLineage(
  lineage: OperationLineage,
  causationId: string,
): OperationLineage {
  return operationLineage({
    requestId: lineage.requestId,
    correlationId: lineage.correlationId,
    causationId,
  });
}

export function parseOperationLineage(input: unknown): OperationLineage {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("lineage must be an object.");
  }
  if (
    !("requestId" in input) ||
    !("correlationId" in input) ||
    !("causationId" in input)
  ) {
    throw new TypeError("lineage is missing required fields.");
  }
  const values = input as {
    requestId: unknown;
    correlationId: unknown;
    causationId: unknown;
  };
  if (
    typeof values.requestId !== "string" ||
    typeof values.correlationId !== "string" ||
    (typeof values.causationId !== "string" && values.causationId !== null)
  ) {
    throw new TypeError("lineage fields are invalid.");
  }
  return operationLineage({
    requestId: values.requestId,
    correlationId: values.correlationId,
    causationId: values.causationId,
  });
}

export function isExpired(expiresAt: Date | null, at = new Date()): boolean {
  return expiresAt !== null && expiresAt <= at;
}

export function isActiveGrant<DomainObject extends { expiresAt: Date | null }>(
  domainObject: DomainObject,
  at = new Date(),
): boolean {
  return !isExpired(domainObject.expiresAt, at);
}

export function touch<T extends Timestamped>(entity: T, at = new Date()): T {
  return {
    ...entity,
    updatedAt: at,
  };
}
