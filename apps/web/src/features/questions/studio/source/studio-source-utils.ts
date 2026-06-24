import { createNextSourceId } from "./source-usage";
import {
  isDuplicateLocalWorkbookFile,
  type StudioWorkbookSource,
} from "./studio-source-model";

type LocalStudioWorkbookSource = StudioWorkbookSource & {
  backing: Extract<StudioWorkbookSource["backing"], { kind: "local_file" }>;
};

export function createLocalWorkbookSourceDraft(input: {
  file: File;
  existingSources: readonly StudioWorkbookSource[];
}):
  | { status: "duplicate" }
  | { status: "created"; source: LocalStudioWorkbookSource } {
  if (
    isDuplicateLocalWorkbookFile({
      file: input.file,
      sources: input.existingSources,
    })
  ) {
    return { status: "duplicate" };
  }

  const name = stripWorkbookExtension(input.file.name);

  return {
    source: {
      backing: {
        byteSize: input.file.size,
        file: input.file,
        kind: "local_file",
        lastModified: input.file.lastModified,
        originalName: input.file.name,
        parsedWorkbook: null,
        parseError: null,
        parseStatus: "parsing",
        uploadError: null,
        uploadStatus: "not_uploaded",
        workbookId: null,
      },
      createdAt: new Date(),
      name,
      sourceId: createNextSourceId({
        existingSources: input.existingSources,
        preferredName: name,
        type: "workbook",
      }),
      type: "workbook",
    },
    status: "created",
  };
}

function stripWorkbookExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, "");
}
