import { presentDate, presentNullableDate } from "@lemma/http";
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
  FileDownloadUrl as FileDownloadUrlDto,
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
  return {
    download: toFileDownloadUrlDto(result.download),
  };
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
    deletedAt: presentNullableDate(file.deletedAt),
    createdAt: presentDate(file.createdAt),
    updatedAt: presentDate(file.updatedAt),
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
    uploadExpiresAt: presentDate(upload.uploadExpiresAt),
    completedAt: presentNullableDate(upload.completedAt),
    createdAt: presentDate(upload.createdAt),
    updatedAt: presentDate(upload.updatedAt),
  };
}

function toFileDownloadUrlDto(
  download: DownloadUrlResult["download"],
): FileDownloadUrlDto {
  return {
    url: download.url,
    method: download.method,
    expiresInSeconds: download.expiresInSeconds,
  };
}
