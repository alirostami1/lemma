import type { DatabaseExecutor } from "@lemma/db";
import type { Files, FileUploads } from "@lemma/db/tables";
import type { JsonObject } from "@lemma/domain";
import type { Insertable, Selectable, Updateable } from "kysely";
import type { FilesRepository } from "../application/index.js";
import {
  type File,
  type FileId,
  type FileStatus,
  type FileUpload,
  type FileUploadId,
  InvalidFileStateError,
  reconstituteFile,
  reconstituteFileUpload,
  type UserId,
} from "../domain/index.js";

export class KyselyFilesRepository implements FilesRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async listFilesByOwnerUserId(input: {
    ownerUserId: UserId;
    statuses: readonly FileStatus[];
    purpose?: string;
    limit: number;
    cursor?: Date;
  }): Promise<File[]> {
    let query = this.db
      .selectFrom("files")
      .selectAll()
      .where("ownerUserId", "=", input.ownerUserId)
      .where("status", "in", input.statuses);

    if (input.purpose) {
      query = query.where("purpose", "=", input.purpose);
    }

    if (input.cursor) {
      query = query.where("createdAt", "<", input.cursor);
    }

    const rows = await query
      .orderBy("createdAt", "desc")
      .limit(input.limit)
      .execute();

    return rows.map(mapFileRowToDomain);
  }

  async findFileById(fileId: FileId): Promise<File | null> {
    const row = await this.db
      .selectFrom("files")
      .selectAll()
      .where("id", "=", fileId)
      .executeTakeFirst();

    return row ? mapFileRowToDomain(row) : null;
  }

  async findFileByUploadId(uploadId: FileUploadId): Promise<File | null> {
    const row = await this.db
      .selectFrom("files")
      .selectAll()
      .where("uploadId", "=", uploadId)
      .executeTakeFirst();

    return row ? mapFileRowToDomain(row) : null;
  }

  async createFileFromUpload(input: {
    file: File;
    upload: FileUpload;
  }): Promise<File> {
    const fileRow = await this.db
      .insertInto("files")
      .values(mapFileToInsert(input.file))
      .onConflict((oc) => oc.column("uploadId").doNothing())
      .returningAll()
      .executeTakeFirst();

    if (!fileRow) {
      throw new InvalidFileStateError(
        "File upload has already been completed.",
      );
    }

    await this.updateFileUpload(input.upload);

    return mapFileRowToDomain(fileRow);
  }

  async updateFile(file: File): Promise<File | null> {
    const row = await this.db
      .updateTable("files")
      .set(mapFileToUpdate(file))
      .where("id", "=", file.id)
      .returningAll()
      .executeTakeFirst();

    return row ? mapFileRowToDomain(row) : null;
  }

  async createFileUpload(upload: FileUpload): Promise<FileUpload> {
    const row = await this.db
      .insertInto("fileUploads")
      .values(mapFileUploadToInsert(upload))
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapFileUploadRowToDomain(row);
  }

  async findFileUploadById(uploadId: FileUploadId): Promise<FileUpload | null> {
    const row = await this.db
      .selectFrom("fileUploads")
      .selectAll()
      .where("id", "=", uploadId)
      .executeTakeFirst();

    return row ? mapFileUploadRowToDomain(row) : null;
  }

  async updateFileUpload(upload: FileUpload): Promise<FileUpload | null> {
    const row = await this.db
      .updateTable("fileUploads")
      .set(mapFileUploadToUpdate(upload))
      .where("id", "=", upload.id)
      .returningAll()
      .executeTakeFirst();

    return row ? mapFileUploadRowToDomain(row) : null;
  }
}

function mapFileRowToDomain(row: Selectable<Files>): File {
  return reconstituteFile({
    id: row.id,
    uploadId: row.uploadId,
    ownerUserId: row.ownerUserId,
    createdByUserId: row.createdByUserId,
    bucket: row.bucket,
    objectKey: row.objectKey,
    originalName: row.originalName,
    contentType: row.contentType,
    byteSize: Number(row.byteSize),
    checksumSha256: row.checksumSha256,
    status: row.status,
    purpose: row.purpose,
    metadata: row.metadata as Record<string, unknown>,
    retentionExpiresAt: row.retentionExpiresAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function mapFileUploadRowToDomain(row: Selectable<FileUploads>): FileUpload {
  return reconstituteFileUpload({
    id: row.id,
    createdByUserId: row.createdByUserId,
    bucket: row.bucket,
    objectKey: row.objectKey,
    originalName: row.originalName,
    contentType: row.contentType,
    expectedByteSize: Number(row.expectedByteSize),
    checksumSha256: row.checksumSha256,
    purpose: row.purpose,
    status: row.status,
    metadata: row.metadata as Record<string, unknown>,
    uploadExpiresAt: row.uploadExpiresAt,
    completedAt: row.completedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function mapFileToInsert(file: File): Insertable<Files> {
  return {
    id: file.id,
    uploadId: file.uploadId,
    ownerUserId: file.ownerUserId,
    createdByUserId: file.createdByUserId,
    bucket: file.bucket,
    objectKey: file.objectKey,
    originalName: file.originalName,
    contentType: file.contentType,
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
    status: file.status,
    purpose: file.purpose,
    metadata: file.metadata as JsonObject,
    retentionExpiresAt: file.retentionExpiresAt,
    deletedAt: file.deletedAt,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

function mapFileToUpdate(file: File): Updateable<Files> {
  return {
    ownerUserId: file.ownerUserId,
    createdByUserId: file.createdByUserId,
    bucket: file.bucket,
    objectKey: file.objectKey,
    originalName: file.originalName,
    contentType: file.contentType,
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
    status: file.status,
    purpose: file.purpose,
    metadata: file.metadata as JsonObject,
    retentionExpiresAt: file.retentionExpiresAt,
    deletedAt: file.deletedAt,
    updatedAt: file.updatedAt,
  };
}

function mapFileUploadToInsert(upload: FileUpload): Insertable<FileUploads> {
  return {
    id: upload.id,
    createdByUserId: upload.createdByUserId,
    bucket: upload.bucket,
    objectKey: upload.objectKey,
    originalName: upload.originalName,
    contentType: upload.contentType,
    expectedByteSize: upload.expectedByteSize,
    checksumSha256: upload.checksumSha256,
    purpose: upload.purpose,
    status: upload.status,
    metadata: upload.metadata as JsonObject,
    uploadExpiresAt: upload.uploadExpiresAt,
    completedAt: upload.completedAt,
    lastError: upload.lastError,
    createdAt: upload.createdAt,
    updatedAt: upload.updatedAt,
  };
}

function mapFileUploadToUpdate(upload: FileUpload): Updateable<FileUploads> {
  return {
    status: upload.status,
    completedAt: upload.completedAt,
    lastError: upload.lastError,
    updatedAt: upload.updatedAt,
  };
}
