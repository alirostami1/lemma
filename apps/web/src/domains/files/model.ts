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
  byteSize: number;
  checksumSha256: string;
  contentType: FileContentType;
  createdAt: Date;
  createdByUserId: string;
  deletedAt: Date | null;
  id: string;
  originalName: string;
  ownerUserId: string;
  purpose: FilePurpose;
  status: FileStatus;
  updatedAt: Date;
}

export interface FileUpload {
  checksumSha256: string;
  completedAt: Date | null;
  contentType: FileContentType;
  createdAt: Date;
  createdByUserId: string;
  expectedByteSize: number;
  id: string;
  originalName: string;
  purpose: FileUploadPurpose;
  status: FileUploadStatus;
  updatedAt: Date;
  uploadExpiresAt: Date;
}

export interface FileUploadUrl {
  expiresInSeconds: number;
  headers: Record<string, string>;
  method: FileUploadMethod;
  url: string;
}

export interface FileDownloadUrl {
  expiresInSeconds: number;
  method: FileDownloadMethod;
  url: string;
}

export interface CreateFileUploadInput {
  byteSize: number;
  checksumSha256: string;
  contentType: FileContentType;
  originalName: string;
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
  cursor?: string;
  limit?: number;
  purpose?: FilePurpose;
  status?: FileStatus;
}

export interface FilesPage {
  files: File[];
  nextCursor: string | null;
}
