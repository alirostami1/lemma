export type FilePurpose = "workbook";

export type FileStatus = "uploaded" | "deleting" | "deleted";

export type FileContentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type FileUploadPurpose = "workbook";

export type FileUploadStatus =
  | "initiated"
  | "verified"
  | "failed"
  | "expired"
  | "cancelled";

export type FileUploadMethod = "PUT";

export type FileDownloadMethod = "GET";

export interface File {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  originalName: string;
  contentType: FileContentType;
  byteSize: number;
  checksumSha256: string;
  status: FileStatus;
  purpose: FilePurpose;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileUpload {
  id: string;
  createdByUserId: string;
  originalName: string;
  contentType: FileContentType;
  expectedByteSize: number;
  checksumSha256: string;
  status: FileUploadStatus;
  purpose: FileUploadPurpose;
  uploadExpiresAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileUploadUrl {
  url: string;
  method: FileUploadMethod;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export interface FileDownloadUrl {
  url: string;
  method: FileDownloadMethod;
  expiresInSeconds: number;
}

export interface CreateFileUploadInput {
  originalName: string;
  contentType: FileContentType;
  byteSize: number;
  checksumSha256: string;
  purpose: FileUploadPurpose;
}

export interface CompleteFileUploadInput {
  uploadId: string;
}

export interface CreateFileDownloadUrlInput {
  fileId: string;
}

export interface FileUploadResult {
  upload: FileUpload;
  uploadUrl: FileUploadUrl;
}

export interface ListFilesInput {
  limit?: number;
  cursor?: string;
  status?: FileStatus;
  purpose?: FilePurpose;
}

export interface FilesPage {
  files: File[];
  nextCursor: string | null;
}
