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
    bucket: row.bucket,
    byteSize: Number(row.byteSize),
    checksumSha256: row.checksumSha256,
    contentType: row.contentType,
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId,
    deletedAt: row.deletedAt,
    id: row.id,
    metadata: row.metadata as Record<string, unknown>,
    objectKey: row.objectKey,
    originalName: row.originalName,
    ownerUserId: row.ownerUserId,
    purpose: row.purpose,
    retentionExpiresAt: row.retentionExpiresAt,
    status: row.status,
    updatedAt: row.updatedAt,
    uploadId: row.uploadId,
  });
}

function mapFileUploadRowToDomain(row: Selectable<FileUploads>): FileUpload {
  return reconstituteFileUpload({
    bucket: row.bucket,
    checksumSha256: row.checksumSha256,
    completedAt: row.completedAt,
    contentType: row.contentType,
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId,
    expectedByteSize: Number(row.expectedByteSize),
    id: row.id,
    lastError: row.lastError,
    metadata: row.metadata as Record<string, unknown>,
    objectKey: row.objectKey,
    originalName: row.originalName,
    purpose: row.purpose,
    status: row.status,
    updatedAt: row.updatedAt,
    uploadExpiresAt: row.uploadExpiresAt,
  });
}

function mapFileToInsert(file: File): Insertable<Files> {
  return {
    bucket: file.bucket,
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
    contentType: file.contentType,
    createdAt: file.createdAt,
    createdByUserId: file.createdByUserId,
    deletedAt: file.deletedAt,
    id: file.id,
    metadata: file.metadata as JsonObject,
    objectKey: file.objectKey,
    originalName: file.originalName,
    ownerUserId: file.ownerUserId,
    purpose: file.purpose,
    retentionExpiresAt: file.retentionExpiresAt,
    status: file.status,
    updatedAt: file.updatedAt,
    uploadId: file.uploadId,
  };
}

function mapFileToUpdate(file: File): Updateable<Files> {
  return {
    bucket: file.bucket,
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
    contentType: file.contentType,
    createdByUserId: file.createdByUserId,
    deletedAt: file.deletedAt,
    metadata: file.metadata as JsonObject,
    objectKey: file.objectKey,
    originalName: file.originalName,
    ownerUserId: file.ownerUserId,
    purpose: file.purpose,
    retentionExpiresAt: file.retentionExpiresAt,
    status: file.status,
    updatedAt: file.updatedAt,
  };
}

function mapFileUploadToInsert(upload: FileUpload): Insertable<FileUploads> {
  return {
    bucket: upload.bucket,
    checksumSha256: upload.checksumSha256,
    completedAt: upload.completedAt,
    contentType: upload.contentType,
    createdAt: upload.createdAt,
    createdByUserId: upload.createdByUserId,
    expectedByteSize: upload.expectedByteSize,
    id: upload.id,
    lastError: upload.lastError,
    metadata: upload.metadata as JsonObject,
    objectKey: upload.objectKey,
    originalName: upload.originalName,
    purpose: upload.purpose,
    status: upload.status,
    updatedAt: upload.updatedAt,
    uploadExpiresAt: upload.uploadExpiresAt,
  };
}

function mapFileUploadToUpdate(upload: FileUpload): Updateable<FileUploads> {
  return {
    completedAt: upload.completedAt,
    lastError: upload.lastError,
    status: upload.status,
    updatedAt: upload.updatedAt,
  };
}
