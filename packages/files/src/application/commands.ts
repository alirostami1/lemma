import type { CurrentUser } from "@lemma/identity/application";
import type { File, FileUpload } from "../domain/index.js";

export type ListFilesCommand = {
  currentUser: CurrentUser;
  limit?: number;
  cursor?: string;
  status?: string;
  purpose?: string;
};

export type CreateFileUploadCommand = {
  currentUser: CurrentUser;
  originalName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  purpose: string;
};

export type GetFileCommand = {
  currentUser: CurrentUser;
  fileId: string;
};

export type GetFileForOwnerUserIdCommand = {
  ownerUserId: string;
  fileId: string;
};

export type UpdateFileCommand = {
  currentUser: CurrentUser;
  fileId: string;
  patch: {
    originalName?: string;
    purpose?: string;
  };
};

export type CompleteFileUploadCommand = {
  currentUser: CurrentUser;
  uploadId: string;
};

export type DeleteFileCommand = {
  currentUser: CurrentUser;
  fileId: string;
};

export type CreateDownloadUrlCommand = {
  currentUser: CurrentUser;
  fileId: string;
};

export type HandleFileDeletionCommand = {
  fileId: string;
};

export type HandleFileUploadExpirationCommand = {
  uploadId: string;
};

export type FilesResult = {
  files: File[];
  nextCursor: string | null;
};

export type FileResult = {
  file: File;
};

export type CreateFileUploadResult = {
  upload: FileUpload;
  uploadUrl: {
    url: string;
    method: "PUT";
    expiresInSeconds: number;
    headers: Record<string, string>;
  };
};

export type DownloadUrlResult = {
  download: {
    url: string;
    method: "GET";
    expiresInSeconds: number;
  };
};
