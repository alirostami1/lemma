import {
  completeFileUpload as completeFileUploadGenerated,
  createFileDownloadUrl as createFileDownloadUrlGenerated,
  createFileUpload as createFileUploadGenerated,
  getFile as getFileGenerated,
  listFiles as listFilesGenerated,
} from "#/api/generated/files/files";
import {
  mapCreateFileDownloadUrlResponse,
  mapCreateFileUploadResponse,
  mapFileResponse,
  mapFilesResponse,
} from "./mappers";
import type {
  CompleteFileUploadInput,
  CreateFileDownloadUrlInput,
  CreateFileUploadInput,
  File,
  FileDownloadUrl,
  FilesPage,
  FileUploadResult,
  ListFilesInput,
} from "./model";

export async function listFiles(input?: ListFilesInput): Promise<FilesPage> {
  return mapFilesResponse(await listFilesGenerated(input));
}

export async function getFile(fileId: string): Promise<File> {
  return mapFileResponse(await getFileGenerated(fileId));
}

export async function createFileUpload(
  input: CreateFileUploadInput,
): Promise<FileUploadResult> {
  return mapCreateFileUploadResponse(await createFileUploadGenerated(input));
}

export async function completeFileUpload(
  input: CompleteFileUploadInput,
): Promise<File> {
  return mapFileResponse(await completeFileUploadGenerated(input.uploadId));
}

export async function createFileDownloadUrl(
  input: CreateFileDownloadUrlInput,
): Promise<FileDownloadUrl> {
  return mapCreateFileDownloadUrlResponse(
    await createFileDownloadUrlGenerated(input.fileId),
  );
}
