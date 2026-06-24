import { computeFileSha256Hex } from "#/domains/files/checksum";
import type {
  CompleteFileUploadInput,
  CreateFileUploadInput,
  FileUploadResult,
  File as UploadedFile,
} from "#/domains/files/model";
import type { CreateWorkbookInput, Workbook } from "./model";

export async function uploadWorkbookFileRuntime(input: {
  file: File;
  name: string;
  createFileUpload(input: CreateFileUploadInput): Promise<FileUploadResult>;
  completeFileUpload(input: CompleteFileUploadInput): Promise<UploadedFile>;
  createWorkbook(input: CreateWorkbookInput): Promise<Workbook>;
}): Promise<Workbook> {
  const checksumSha256 = await computeFileSha256Hex(input.file);
  const fileUpload = await input.createFileUpload({
    byteSize: input.file.size,
    checksumSha256,
    contentType: input.file.type as CreateFileUploadInput["contentType"],
    originalName: input.file.name,
    purpose: "workbook",
  });

  const uploadResult = await fetch(fileUpload.uploadUrl.url, {
    body: input.file,
    headers: fileUpload.uploadUrl.headers,
    method: fileUpload.uploadUrl.method,
  });

  if (!uploadResult.ok) {
    throw new Error("File upload failed.");
  }

  const file = await input.completeFileUpload({
    uploadId: fileUpload.upload.id,
  });

  return input.createWorkbook({
    fileId: file.id,
    name: input.name,
  });
}

export async function uploadWorkbookDraftFileRuntime(input: {
  file: File;
  createFileUpload(input: CreateFileUploadInput): Promise<FileUploadResult>;
  completeFileUpload(input: CompleteFileUploadInput): Promise<UploadedFile>;
}): Promise<UploadedFile> {
  const checksumSha256 = await computeFileSha256Hex(input.file);
  const fileUpload = await input.createFileUpload({
    byteSize: input.file.size,
    checksumSha256,
    contentType: input.file.type as CreateFileUploadInput["contentType"],
    originalName: input.file.name,
    purpose: "workbook",
  });
  const uploadResult = await fetch(fileUpload.uploadUrl.url, {
    body: input.file,
    headers: fileUpload.uploadUrl.headers,
    method: fileUpload.uploadUrl.method,
  });
  if (!uploadResult.ok) throw new Error("File upload failed.");
  return input.completeFileUpload({ uploadId: fileUpload.upload.id });
}
