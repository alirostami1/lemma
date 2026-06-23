import type {
  QuestionBlueprintDraftSource,
  QuestionBlueprintWorkbookSource,
} from "#/domains/questions/model";
import type {
  LocalWorkbookParseError,
  LocalWorkbookParseResult,
} from "#/domains/workbooks/local-xlsx";
import { parseLocalWorkbookFile } from "#/domains/workbooks/local-xlsx";
import { readStudioDraftWorkbookFile } from "../studio-draft-assets-store";

export const MISSING_LOCAL_FILE_MESSAGE =
  "Workbook file missing. Reattach the file to continue.";
export const DRAFT_STORAGE_READ_ERROR_MESSAGE =
  "Could not read browser draft storage.";
export const DRAFT_STORAGE_RESTORE_ERROR_MESSAGE =
  "Could not restore browser draft storage.";

export type StudioSource = StudioWorkbookSource;
export type StudioSourceType = StudioSource["type"];

export type StudioWorkbookSource = {
  type: "workbook";
  sourceId: string;
  name: string;
  backing: StudioWorkbookSourceBacking;
  createdAt: Date;
};

export type StudioWorkbookSourceBacking =
  | {
      kind: "local_file";
      file: File;
      originalName: string;
      byteSize: number;
      lastModified: number;
      parseStatus: "parsing" | "parsed" | "failed";
      parsedWorkbook: LocalWorkbookParseResult | null;
      parseError: LocalWorkbookParseError | null;
      uploadStatus: "not_uploaded" | "uploading" | "uploaded" | "failed";
      uploadError: string | null;
      workbookId: null;
    }
  | {
      kind: "draft_file";
      fileId: string;
      workbookId: null;
      originalName: string;
      byteSize: number;
      checksumSha256: string;
      previewStatus: "idle" | "loading" | "loaded" | "failed";
      previewError: string | null;
      parsedWorkbook: LocalWorkbookParseResult | null;
    }
  | {
      kind: "restoring_local_file";
      originalName: string;
      byteSize: number;
      lastModified: number;
      workbookId: null;
    }
  | {
      kind: "missing_local_file";
      originalName: string;
      byteSize: number;
      lastModified: number;
      parseError: string;
      workbookId: null;
    }
  | {
      kind: "persisted_workbook";
      workbookId: string;
      originalName: string;
      byteSize: number | null;
      parsedWorkbook: LocalWorkbookParseResult | null;
    };

export type SerializableStudioSource =
  | {
      type: "workbook";
      sourceId: string;
      name: string;
      createdAt: string;
      backing: {
        kind: "local_file";
        originalName: string;
        byteSize: number;
        lastModified: number;
        parseStatus: "parsed" | "failed";
      };
    }
  | {
      type: "workbook";
      sourceId: string;
      name: string;
      createdAt: string;
      backing: {
        kind: "draft_file";
        fileId: string;
        originalName: string;
        byteSize: number;
        checksumSha256: string;
      };
    }
  | {
      type: "workbook";
      sourceId: string;
      name: string;
      createdAt: string;
      backing: {
        kind: "missing_local_file";
        originalName: string;
        byteSize: number;
        lastModified: number;
        parseError: string;
      };
    }
  | {
      type: "workbook";
      sourceId: string;
      name: string;
      createdAt: string;
      backing: {
        kind: "persisted_workbook";
        workbookId: string;
        originalName: string;
        byteSize: number | null;
      };
    };

export type StudioSourceFingerprint =
  | {
      type: "workbook";
      sourceId: string;
      name: string;
      backing: {
        kind: "local_file";
        originalName: string;
        byteSize: number;
        lastModified: number;
        parseStatus: "parsing" | "parsed" | "failed";
      };
    }
  | {
      type: "workbook";
      sourceId: string;
      name: string;
      backing: {
        kind: "draft_file";
        fileId: string;
      };
    }
  | {
      type: "workbook";
      sourceId: string;
      name: string;
      backing: {
        kind: "restoring_local_file";
        originalName: string;
        byteSize: number;
        lastModified: number;
      };
    }
  | {
      type: "workbook";
      sourceId: string;
      name: string;
      backing: {
        kind: "missing_local_file";
        originalName: string;
        byteSize: number;
        lastModified: number;
      };
    }
  | {
      type: "workbook";
      sourceId: string;
      name: string;
      backing: {
        kind: "persisted_workbook";
        workbookId: string;
      };
    };

export function toStudioSourcesFromSavedBlueprint(
  sources: readonly QuestionBlueprintWorkbookSource[],
): StudioSource[] {
  return sources.map((source) => ({
    backing: {
      byteSize: null,
      kind: "persisted_workbook",
      originalName: source.name,
      parsedWorkbook: null,
      workbookId: source.workbookId,
    },
    createdAt: new Date(),
    name: source.name,
    sourceId: source.sourceId,
    type: "workbook",
  }));
}

export function fromDraftToStudioSources(
  sources: readonly QuestionBlueprintDraftSource[],
): StudioSource[] {
  return sources.map((source) => ({
    backing: source.workbookId
      ? {
          byteSize: source.byteSize,
          kind: "persisted_workbook",
          originalName: source.originalName ?? source.name,
          parsedWorkbook: null,
          workbookId: source.workbookId,
        }
      : source.fileId
        ? {
            byteSize: source.byteSize ?? 0,
            checksumSha256: source.checksumSha256 ?? "",
            fileId: source.fileId,
            kind: "draft_file",
            originalName: source.originalName ?? source.name,
            parsedWorkbook: null,
            previewError: null,
            previewStatus: "idle",
            workbookId: null,
          }
        : {
            byteSize: source.byteSize ?? 0,
            kind: "missing_local_file",
            lastModified: 0,
            originalName: source.originalName ?? source.name,
            parseError: "Attach workbook file before publishing.",
            workbookId: null,
          },
    createdAt: new Date(),
    name: source.name,
    sourceId: source.sourceId,
    type: "workbook",
  }));
}

export function fromStudioSourcesToDraftSources(
  sources: readonly StudioSource[],
): QuestionBlueprintDraftSource[] {
  return sources.map((source) => ({
    byteSize: source.backing.byteSize,
    checksumSha256:
      source.backing.kind === "draft_file"
        ? source.backing.checksumSha256
        : null,
    fileId: source.backing.kind === "draft_file" ? source.backing.fileId : null,
    name: source.name,
    originalName: source.backing.originalName,
    sourceId: source.sourceId,
    status:
      source.backing.kind === "persisted_workbook"
        ? "validated"
        : source.backing.kind === "draft_file"
          ? "uploaded"
          : source.backing.kind === "missing_local_file"
            ? "invalid"
            : "local",
    type: "workbook",
    workbookId:
      source.backing.kind === "persisted_workbook"
        ? source.backing.workbookId
        : null,
  }));
}

export function toQuestionBlueprintWorkbookSources(
  sources: readonly StudioSource[],
): QuestionBlueprintWorkbookSource[] {
  return sources.flatMap((source) =>
    source.backing.kind !== "persisted_workbook"
      ? []
      : [
          {
            name: source.name,
            sourceId: source.sourceId,
            workbookId: source.backing.workbookId,
          },
        ],
  );
}

// Editor dialogs need source options before local files have server workbook IDs.
// Do not use this helper for API persistence.
export function toEditorAttachedWorkbookSources(
  sources: readonly StudioSource[],
): QuestionBlueprintWorkbookSource[] {
  return sources.map((source) => ({
    name: source.name,
    sourceId: source.sourceId,
    workbookId: getAttachedWorkbookId(source),
  }));
}

export function serializeStudioSources(
  sources: readonly StudioSource[],
): SerializableStudioSource[] {
  const serialized: SerializableStudioSource[] = [];

  for (const source of sources) {
    switch (source.backing.kind) {
      case "persisted_workbook":
        serialized.push({
          backing: {
            byteSize: source.backing.byteSize,
            kind: "persisted_workbook",
            originalName: source.backing.originalName,
            workbookId: source.backing.workbookId,
          },
          createdAt: source.createdAt.toISOString(),
          name: source.name,
          sourceId: source.sourceId,
          type: "workbook",
        });
        break;
      case "draft_file":
        serialized.push({
          backing: {
            byteSize: source.backing.byteSize,
            checksumSha256: source.backing.checksumSha256,
            fileId: source.backing.fileId,
            kind: "draft_file",
            originalName: source.backing.originalName,
          },
          createdAt: source.createdAt.toISOString(),
          name: source.name,
          sourceId: source.sourceId,
          type: "workbook",
        });
        break;

      case "local_file":
        serialized.push({
          backing: {
            byteSize: source.backing.byteSize,
            kind: "local_file",
            lastModified: source.backing.lastModified,
            originalName: source.backing.originalName,
            parseStatus:
              source.backing.parseStatus === "failed" ? "failed" : "parsed",
          },
          createdAt: source.createdAt.toISOString(),
          name: source.name,
          sourceId: source.sourceId,
          type: "workbook",
        });
        break;

      case "restoring_local_file":
        serialized.push({
          backing: {
            byteSize: source.backing.byteSize,
            kind: "local_file",
            lastModified: source.backing.lastModified,
            originalName: source.backing.originalName,
            parseStatus: "parsed",
          },
          createdAt: source.createdAt.toISOString(),
          name: source.name,
          sourceId: source.sourceId,
          type: "workbook",
        });
        break;

      case "missing_local_file":
        serialized.push({
          backing: {
            byteSize: source.backing.byteSize,
            kind: "missing_local_file",
            lastModified: source.backing.lastModified,
            originalName: source.backing.originalName,
            parseError: source.backing.parseError,
          },
          createdAt: source.createdAt.toISOString(),
          name: source.name,
          sourceId: source.sourceId,
          type: "workbook",
        });
        break;

      default:
        assertNeverStudioWorkbookSourceBacking(source.backing);
    }
  }

  return serialized;
}

export function createStudioSourceFingerprints(
  sources: readonly StudioSource[],
): StudioSourceFingerprint[] {
  return sources.map((source) => {
    if (source.backing.kind === "local_file") {
      return {
        backing: {
          byteSize: source.backing.byteSize,
          kind: "local_file",
          lastModified: source.backing.lastModified,
          originalName: source.backing.originalName,
          parseStatus: source.backing.parseStatus,
        },
        name: source.name,
        sourceId: source.sourceId,
        type: "workbook",
      };
    }
    if (source.backing.kind === "draft_file") {
      return {
        backing: { fileId: source.backing.fileId, kind: "draft_file" },
        name: source.name,
        sourceId: source.sourceId,
        type: "workbook",
      };
    }

    if (source.backing.kind === "missing_local_file") {
      return {
        backing: {
          byteSize: source.backing.byteSize,
          kind: "missing_local_file",
          lastModified: source.backing.lastModified,
          originalName: source.backing.originalName,
        },
        name: source.name,
        sourceId: source.sourceId,
        type: "workbook",
      };
    }

    if (source.backing.kind === "restoring_local_file") {
      return {
        backing: {
          byteSize: source.backing.byteSize,
          kind: "restoring_local_file",
          lastModified: source.backing.lastModified,
          originalName: source.backing.originalName,
        },
        name: source.name,
        sourceId: source.sourceId,
        type: "workbook",
      };
    }

    return {
      backing: {
        kind: "persisted_workbook",
        workbookId: source.backing.workbookId,
      },
      name: source.name,
      sourceId: source.sourceId,
      type: "workbook",
    };
  });
}

export function deserializeStudioSources(
  sources: readonly SerializableStudioSource[],
): StudioSource[] {
  return sources.map((source) => {
    if (source.backing.kind === "persisted_workbook") {
      return {
        backing: {
          byteSize: source.backing.byteSize,
          kind: "persisted_workbook",
          originalName: source.backing.originalName,
          parsedWorkbook: null,
          workbookId: source.backing.workbookId,
        },
        createdAt: new Date(source.createdAt),
        name: source.name,
        sourceId: source.sourceId,
        type: "workbook",
      };
    }
    if (source.backing.kind === "draft_file") {
      return {
        backing: {
          byteSize: source.backing.byteSize,
          checksumSha256: source.backing.checksumSha256,
          fileId: source.backing.fileId,
          kind: "draft_file",
          originalName: source.backing.originalName,
          parsedWorkbook: null,
          previewError: null,
          previewStatus: "idle",
          workbookId: null,
        },
        createdAt: new Date(source.createdAt),
        name: source.name,
        sourceId: source.sourceId,
        type: "workbook",
      };
    }

    if (source.backing.kind === "local_file") {
      return {
        backing: {
          byteSize: source.backing.byteSize,
          kind: "restoring_local_file",
          lastModified: source.backing.lastModified,
          originalName: source.backing.originalName,
          workbookId: null,
        },
        createdAt: new Date(source.createdAt),
        name: source.name,
        sourceId: source.sourceId,
        type: "workbook",
      };
    }

    return {
      backing: {
        byteSize: source.backing.byteSize,
        kind: "missing_local_file",
        lastModified: source.backing.lastModified,
        originalName: source.backing.originalName,
        parseError: source.backing.parseError,
        workbookId: null,
      },
      createdAt: new Date(source.createdAt),
      name: source.name,
      sourceId: source.sourceId,
      type: "workbook",
    };
  });
}

export function isDuplicateLocalWorkbookFile(input: {
  file: File;
  sources: readonly StudioSource[];
}): boolean {
  return input.sources.some(
    (source) =>
      source.type === "workbook" &&
      (source.backing.kind === "local_file" ||
        source.backing.kind === "restoring_local_file" ||
        source.backing.kind === "missing_local_file") &&
      source.backing.originalName === input.file.name &&
      source.backing.byteSize === input.file.size &&
      source.backing.lastModified === input.file.lastModified,
  );
}

export async function hydrateStudioSourcesFromDraftAssets(input: {
  draftKey: string;
  sources: readonly StudioSource[];
}): Promise<StudioSource[]> {
  const hydratedSources = await Promise.all(
    input.sources.map((source) =>
      hydrateStudioSourceFromDraftAsset(input.draftKey, source),
    ),
  );

  return hydratedSources;
}

async function hydrateStudioSourceFromDraftAsset(
  draftKey: string,
  source: StudioSource,
): Promise<StudioSource> {
  if (source.backing.kind !== "restoring_local_file") {
    return source;
  }

  try {
    const fileResult = await readStudioDraftWorkbookFile({
      draftKey,
      sourceId: source.sourceId,
    });
    if (!fileResult.ok) {
      return createMissingLocalFileSource(
        source,
        DRAFT_STORAGE_READ_ERROR_MESSAGE,
      );
    }
    if (fileResult.value === null) {
      return createMissingLocalFileSource(source, MISSING_LOCAL_FILE_MESSAGE);
    }

    const file = fileResult.value;
    try {
      const parseOutcome = await parseLocalWorkbookFile(file);
      if (parseOutcome.status === "failed") {
        return createLocalFileSourceFromRestoredFile(source, file, {
          parsedWorkbook: null,
          parseError: parseOutcome.error,
          parseStatus: "failed",
        });
      }

      return createLocalFileSourceFromRestoredFile(source, file, {
        parsedWorkbook: parseOutcome.workbook,
        parseError: null,
        parseStatus: "parsed",
      });
    } catch {
      return createLocalFileSourceFromRestoredFile(source, file, {
        parsedWorkbook: null,
        parseError: createDraftRestoreParseError(),
        parseStatus: "failed",
      });
    }
  } catch {
    return createMissingLocalFileSource(
      source,
      DRAFT_STORAGE_RESTORE_ERROR_MESSAGE,
    );
  }
}

function createLocalFileSourceFromRestoredFile(
  source: StudioSource,
  file: File,
  parse: Pick<
    Extract<StudioWorkbookSourceBacking, { kind: "local_file" }>,
    "parseStatus" | "parsedWorkbook" | "parseError"
  >,
): StudioSource {
  return {
    ...source,
    backing: {
      byteSize: file.size,
      file,
      kind: "local_file",
      lastModified: file.lastModified,
      originalName: file.name,
      parsedWorkbook: parse.parsedWorkbook,
      parseError: parse.parseError,
      parseStatus: parse.parseStatus,
      uploadError: null,
      uploadStatus: "not_uploaded",
      workbookId: null,
    },
  };
}

export function createMissingLocalFileSource(
  source: StudioSource,
  parseError: string,
): StudioSource {
  if (source.backing.kind !== "restoring_local_file") {
    return source;
  }

  return {
    ...source,
    backing: {
      byteSize: source.backing.byteSize,
      kind: "missing_local_file",
      lastModified: source.backing.lastModified,
      originalName: source.backing.originalName,
      parseError,
      workbookId: null,
    },
  };
}

function createDraftRestoreParseError(): LocalWorkbookParseError {
  return {
    code: "parse_failed",
    message: "Workbook could not be parsed.",
  };
}

function getAttachedWorkbookId(source: StudioSource): string {
  return source.backing.kind === "persisted_workbook"
    ? source.backing.workbookId
    : source.sourceId;
}

function assertNeverStudioWorkbookSourceBacking(value: never): never {
  throw new Error(
    `Unsupported Studio workbook source backing: ${String(value)}`,
  );
}
