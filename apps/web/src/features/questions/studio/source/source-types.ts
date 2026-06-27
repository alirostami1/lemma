import type { StudioSource } from "./studio-source-model";

export function getStudioSourceDisplayName(source: StudioSource): string {
  return source.name.trim().length > 0 ? source.name : "Workbook source";
}

export function getStudioSourceTypeLabel(source: StudioSource): string {
  if (source.type === "workbook") {
    return "Workbook";
  }

  throw new Error(`Unknown source type: ${JSON.stringify(source)}`);
}

export function getStudioSourceStableKey(source: StudioSource): string {
  return source.sourceId;
}
