export function encodeListCursor(date: Date | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function decodeListCursor(cursor: string | undefined): Date | undefined {
  if (!cursor) {
    return undefined;
  }
  const date = new Date(cursor);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function normalizeListLimit(limit: number | undefined): number {
  if (!limit) {
    return 50;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}
