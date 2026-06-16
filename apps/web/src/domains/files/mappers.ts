import type {
  CreateFileDownloadUrlResponse,
  CreateFileUploadResponse,
  FileDownloadUrl as FileDownloadUrlDto,
  File as FileDto,
  FileResponse,
  FileUpload as FileUploadDto,
  FileUploadUrl as FileUploadUrlDto,
  ListFilesResponse,
} from "#/api/generated/model";
import type {
  File,
  FileDownloadUrl,
  FilesPage,
  FileUpload,
  FileUploadResult,
  FileUploadUrl,
} from "./model";

export function mapFile(dto: FileDto): File {
  return {
    ...dto,
    deletedAt: dto.deletedAt ? new Date(dto.deletedAt) : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapFileUpload(dto: FileUploadDto): FileUpload {
  return {
    ...dto,
    contentType: dto.contentType,
    uploadExpiresAt: new Date(dto.uploadExpiresAt),
    completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapFileUploadUrl(dto: FileUploadUrlDto): FileUploadUrl {
  return {
    ...dto,
    headers: { ...dto.headers },
  };
}

export function mapFileDownloadUrl(dto: FileDownloadUrlDto): FileDownloadUrl {
  return { ...dto };
}

export function mapFilesResponse(response: ListFilesResponse): FilesPage {
  return {
    files: response.files.map(mapFile),
    nextCursor: response.nextCursor,
  };
}

export function mapFileResponse(response: FileResponse): File {
  return mapFile(response.file);
}

export function mapCreateFileUploadResponse(
  response: CreateFileUploadResponse,
): FileUploadResult {
  return {
    upload: mapFileUpload(response.upload),
    uploadUrl: mapFileUploadUrl(response.uploadUrl),
  };
}

export function mapCreateFileDownloadUrlResponse(
  response: CreateFileDownloadUrlResponse,
): FileDownloadUrl {
  return mapFileDownloadUrl(response.download);
}
