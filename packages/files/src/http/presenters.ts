import type {
  CreateFileUploadResult,
  DownloadUrlResult,
  FileResult,
  FilesResult,
} from "../application/index.js";
import type { File, FileUpload } from "../domain/index.js";
import type {
  CreateFileDownloadUrlResponse as CreateFileDownloadUrlResponseDto,
  CreateFileUploadResponse as CreateFileUploadResponseDto,
  File as FileDto,
  FileResponse as FileResponseDto,
  FileUpload as FileUploadDto,
  ListFilesResponse as ListFilesResponseDto,
} from "../gen/types/index.js";

export function presentFiles(result: FilesResult): ListFilesResponseDto {
  return {
    files: result.files.map(toFileDto),
    nextCursor: result.nextCursor,
  };
}

export function presentFile(result: FileResult): FileResponseDto {
  return {
    file: toFileDto(result.file),
  };
}

export function presentCreateFileUpload(
  result: CreateFileUploadResult,
): CreateFileUploadResponseDto {
  return {
    upload: toFileUploadDto(result.upload),
    uploadUrl: {
      url: result.uploadUrl.url,
      method: result.uploadUrl.method,
      expiresInSeconds: result.uploadUrl.expiresInSeconds,
      headers: {
        "Content-Type": result.uploadUrl.headers["Content-Type"] ?? "",
        "x-amz-checksum-sha256":
          result.uploadUrl.headers["x-amz-checksum-sha256"] ?? "",
      },
    },
  };
}

export function presentDownloadFileUrl(
  result: DownloadUrlResult,
): CreateFileDownloadUrlResponseDto {
  return result;
}

function toFileDto(file: File): FileDto {
  return {
    id: file.id,
    ownerUserId: file.ownerUserId,
    createdByUserId: file.createdByUserId,
    originalName: file.originalName,
    contentType: file.contentType,
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
    status: file.status,
    purpose: file.purpose,
    deletedAt: file.deletedAt?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}

function toFileUploadDto(upload: FileUpload): FileUploadDto {
  return {
    id: upload.id,
    createdByUserId: upload.createdByUserId,
    originalName: upload.originalName,
    contentType: upload.contentType,
    expectedByteSize: upload.expectedByteSize,
    checksumSha256: upload.checksumSha256,
    status: upload.status,
    purpose: upload.purpose,
    uploadExpiresAt: upload.uploadExpiresAt.toISOString(),
    completedAt: upload.completedAt?.toISOString() ?? null,
    createdAt: upload.createdAt.toISOString(),
    updatedAt: upload.updatedAt.toISOString(),
  };
}
