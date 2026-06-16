export function normalizeListLimit(value: number | undefined): number {
  if (!value) {
    return 50;
  }
  return Math.min(Math.max(value, 1), 100);
}

export function encodeListCursor(value: Date | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function decodeListCursor(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

export function encodeSnapshotIndexCursor(value: number | undefined): string | null {
  return value === undefined ? null : String(value);
}

export function decodeSnapshotIndexCursor(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const cursor = Number(value);
  return Number.isInteger(cursor) && cursor >= 0 ? cursor : undefined;
}
