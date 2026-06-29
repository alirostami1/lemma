import {
  createWorkbookFromFile,
  fileId as toFileId,
  type UserId,
  type Workbook,
  type WorkbookEngineName,
  type WorkbookId,
  type WorkbookOrigin,
} from "../domain/index.js";

export function createWorkbookForFile(input: {
  at: Date;
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  createdByUserId: UserId;
  engine: WorkbookEngineName;
  fileId: string;
  id: WorkbookId;
  name: string;
  originalName: string;
  origin?: WorkbookOrigin;
  ownerUserId: UserId;
}): Workbook {
  return createWorkbookFromFile(
    {
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256,
      contentType: input.contentType,
      createdByUserId: input.createdByUserId,
      engine: input.engine,
      fileId: toFileId(input.fileId),
      id: input.id,
      name: input.name,
      originalName: input.originalName,
      origin: input.origin,
      ownerUserId: input.ownerUserId,
    },
    input.at,
  );
}
