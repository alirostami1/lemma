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
} from "../generated/types/index.js";

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
      expiresInSeconds: result.uploadUrl.expiresInSeconds,
      headers: {
        "Content-Type": result.uploadUrl.headers["Content-Type"] ?? "",
        "x-amz-checksum-sha256":
          result.uploadUrl.headers["x-amz-checksum-sha256"] ?? "",
      },
      method: result.uploadUrl.method,
      url: result.uploadUrl.url,
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
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
    contentType: file.contentType,
    createdAt: presentDate(file.createdAt),
    createdByUserId: file.createdByUserId,
    deletedAt: presentNullableDate(file.deletedAt),
    id: file.id,
    originalName: file.originalName,
    ownerUserId: file.ownerUserId,
    purpose: file.purpose,
    status: file.status,
    updatedAt: presentDate(file.updatedAt),
  };
}

function toFileUploadDto(upload: FileUpload): FileUploadDto {
  return {
    checksumSha256: upload.checksumSha256,
    completedAt: presentNullableDate(upload.completedAt),
    contentType: upload.contentType,
    createdAt: presentDate(upload.createdAt),
    createdByUserId: upload.createdByUserId,
    expectedByteSize: upload.expectedByteSize,
    id: upload.id,
    originalName: upload.originalName,
    purpose: upload.purpose,
    status: upload.status,
    updatedAt: presentDate(upload.updatedAt),
    uploadExpiresAt: presentDate(upload.uploadExpiresAt),
  };
}

function toFileDownloadUrlDto(
  download: DownloadUrlResult["download"],
): FileDownloadUrlDto {
  return {
    expiresInSeconds: download.expiresInSeconds,
    method: download.method,
    url: download.url,
  };
}
