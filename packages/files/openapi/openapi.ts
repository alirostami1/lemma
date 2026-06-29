import {
  badRequestResponse,
  conflictResponse,
  errorResponseSchema,
  forbiddenResponse,
  keycloakSecurityRequirement,
  keycloakSecurityScheme,
  notFoundResponse,
  type OpenAPI,
  type Param,
  type Paths,
  paramRef,
  type Response,
  responseRef,
  type Schema,
  schemaRef,
  type Tag,
  tagRef,
  unauthorizedResponse,
  uuidV7Param,
  uuidV7StringSchemaObject,
} from "@lemma/http/openapi";
import {
  FILE_CONTENT_TYPE_ACCEPTED_VALUES,
  FILE_STATUS_ACCEPTED_VALUES,
  FILE_UPLOAD_STATUS_ACCEPTED_VALUES,
  MAX_FILE_BYTE_SIZE,
  MAX_ORIGINAL_FILE_NAME_LENGTH,
  PUBLIC_FILE_PURPOSE_ACCEPTED_VALUES,
} from "../src/domain/index.ts";

const filesTag: Tag = {
  description: "File upload, file metadata, and file download URL operations.",
  name: "Files",
};

const fileSchema: Schema = {
  name: "File",
  schema: {
    properties: {
      byteSize: {
        example: 1024,
        exclusiveMinimum: 0,
        maximum: MAX_FILE_BYTE_SIZE,
        type: "integer",
      },
      checksumSha256: {
        example:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        pattern: "^[A-Fa-f0-9]{64}$",
        type: "string",
      },
      contentType: {
        enum: FILE_CONTENT_TYPE_ACCEPTED_VALUES as unknown as string[],
        example:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        type: "string",
      },
      createdAt: {
        format: "date-time",
        type: "string",
      },
      createdByUserId: {
        ...uuidV7StringSchemaObject(),
      },
      deletedAt: {
        format: "date-time",
        type: ["string", "null"],
      },
      id: {
        ...uuidV7StringSchemaObject(),
      },
      originalName: {
        example: "workbook.xlsx",
        maxLength: MAX_ORIGINAL_FILE_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      ownerUserId: {
        ...uuidV7StringSchemaObject(),
      },
      purpose: {
        enum: [...PUBLIC_FILE_PURPOSE_ACCEPTED_VALUES],
        example: "workbook",
        type: "string",
      },
      status: {
        enum: FILE_STATUS_ACCEPTED_VALUES as unknown as string[],
        example: "uploaded",
        type: "string",
      },
      updatedAt: {
        format: "date-time",
        type: "string",
      },
    },
    required: [
      "id",
      "ownerUserId",
      "createdByUserId",
      "originalName",
      "contentType",
      "byteSize",
      "checksumSha256",
      "status",
      "purpose",
      "deletedAt",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};

const fileUploadSchema: Schema = {
  name: "FileUpload",
  schema: {
    properties: {
      checksumSha256: {
        example:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        pattern: "^[A-Fa-f0-9]{64}$",
        type: "string",
      },
      completedAt: {
        format: "date-time",
        type: ["string", "null"],
      },
      contentType: {
        enum: FILE_CONTENT_TYPE_ACCEPTED_VALUES as unknown as string[],
        example:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        type: "string",
      },
      createdAt: {
        format: "date-time",
        type: "string",
      },
      createdByUserId: {
        ...uuidV7StringSchemaObject(),
      },
      expectedByteSize: {
        example: 1024,
        exclusiveMinimum: 0,
        maximum: MAX_FILE_BYTE_SIZE,
        type: "integer",
      },
      id: {
        ...uuidV7StringSchemaObject(),
      },
      originalName: {
        example: "workbook.xlsx",
        maxLength: MAX_ORIGINAL_FILE_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      purpose: {
        enum: [...PUBLIC_FILE_PURPOSE_ACCEPTED_VALUES],
        example: "workbook",
        type: "string",
      },
      status: {
        enum: FILE_UPLOAD_STATUS_ACCEPTED_VALUES as unknown as string[],
        example: "initiated",
        type: "string",
      },
      updatedAt: {
        format: "date-time",
        type: "string",
      },
      uploadExpiresAt: {
        format: "date-time",
        type: "string",
      },
    },
    required: [
      "id",
      "createdByUserId",
      "originalName",
      "contentType",
      "expectedByteSize",
      "checksumSha256",
      "status",
      "purpose",
      "uploadExpiresAt",
      "completedAt",
      "createdAt",
      "updatedAt",
    ],
    type: "object",
  },
};

const listFilesResponseSchema: Schema = {
  name: "ListFilesResponse",
  schema: {
    properties: {
      files: {
        items: schemaRef(fileSchema),
        type: "array",
      },
      nextCursor: {
        minLength: 1,
        type: ["string", "null"],
      },
    },
    required: ["files", "nextCursor"],
    type: "object",
  },
};

const fileResponseSchema: Schema = {
  name: "FileResponse",
  schema: {
    properties: {
      file: schemaRef(fileSchema),
    },
    required: ["file"],
    type: "object",
  },
};

const fileUploadUrlSchema: Schema = {
  name: "FileUploadUrl",
  schema: {
    properties: {
      expiresInSeconds: {
        exclusiveMinimum: 0,
        type: "integer",
      },
      headers: {
        properties: {
          "Content-Type": {
            type: "string",
          },
          "x-amz-checksum-sha256": {
            type: "string",
          },
        },
        required: ["Content-Type", "x-amz-checksum-sha256"],
        type: "object",
      },
      method: {
        enum: ["PUT"],
        type: "string",
      },
      url: {
        format: "uri",
        type: "string",
      },
    },
    required: ["url", "method", "expiresInSeconds", "headers"],
    type: "object",
  },
};

const fileDownloadUrlSchema: Schema = {
  name: "FileDownloadUrl",
  schema: {
    properties: {
      expiresInSeconds: {
        exclusiveMinimum: 0,
        type: "integer",
      },
      method: {
        enum: ["GET"],
        type: "string",
      },
      url: {
        format: "uri",
        type: "string",
      },
    },
    required: ["url", "method", "expiresInSeconds"],
    type: "object",
  },
};

const createFileUploadResponseSchema: Schema = {
  name: "CreateFileUploadResponse",
  schema: {
    properties: {
      upload: schemaRef(fileUploadSchema),
      uploadUrl: schemaRef(fileUploadUrlSchema),
    },
    required: ["upload", "uploadUrl"],
    type: "object",
  },
};

const createFileDownloadUrlResponseSchema: Schema = {
  name: "CreateFileDownloadUrlResponse",
  schema: {
    properties: {
      download: schemaRef(fileDownloadUrlSchema),
    },
    required: ["download"],
    type: "object",
  },
};

const createFileUploadRequestSchema: Schema = {
  name: "CreateFileUploadRequest",
  schema: {
    additionalProperties: false,
    properties: {
      byteSize: {
        exclusiveMinimum: 0,
        maximum: MAX_FILE_BYTE_SIZE,
        type: "integer",
      },
      checksumSha256: {
        pattern: "^[A-Fa-f0-9]{64}$",
        type: "string",
      },
      contentType: {
        enum: FILE_CONTENT_TYPE_ACCEPTED_VALUES as unknown as string[],
        type: "string",
      },
      originalName: {
        maxLength: MAX_ORIGINAL_FILE_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
      purpose: {
        enum: [...PUBLIC_FILE_PURPOSE_ACCEPTED_VALUES],
        type: "string",
      },
    },
    required: [
      "originalName",
      "contentType",
      "byteSize",
      "checksumSha256",
      "purpose",
    ],
    type: "object",
  },
};

const updateFileRequestSchema: Schema = {
  name: "UpdateFileRequest",
  schema: {
    additionalProperties: false,
    minProperties: 1,
    properties: {
      originalName: {
        maxLength: MAX_ORIGINAL_FILE_NAME_LENGTH,
        minLength: 1,
        type: "string",
      },
    },
    type: "object",
  },
};

const upstreamStorageResponse: Response = {
  name: "UpstreamStorage",
  schema: {
    content: {
      "application/json": {
        schema: schemaRef(errorResponseSchema),
      },
    },
    description: "Storage provider operation failed.",
  },
};

const fileParam: Param = { ...uuidV7Param("fileId"), name: "FileParam" };

const fileUploadParam: Param = {
  ...uuidV7Param("uploadId"),
  name: "FileUploadParam",
};

export const tags: readonly Tag[] = Object.freeze([filesTag]);

export const schemas = Object.freeze([
  fileSchema,
  fileUploadSchema,
  listFilesResponseSchema,
  fileResponseSchema,
  fileUploadUrlSchema,
  fileDownloadUrlSchema,
  createFileUploadResponseSchema,
  createFileDownloadUrlResponseSchema,
  createFileUploadRequestSchema,
  updateFileRequestSchema,
]);

export const responses = Object.freeze([
  upstreamStorageResponse,
  badRequestResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
]);
export const params = Object.freeze([fileParam, fileUploadParam]);

export const paths: Paths = Object.freeze({
  "/file-uploads": {
    post: {
      operationId: "createFileUpload",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(createFileUploadRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "201": {
          content: {
            "application/json": {
              schema: schemaRef(createFileUploadResponseSchema),
            },
          },
          description: "File upload session created.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamStorageResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Create file upload",
      tags: [tagRef(filesTag)],
    },
  },

  "/file-uploads/{uploadId}/completions": {
    parameters: [paramRef(fileUploadParam)],
    post: {
      operationId: "completeFileUpload",
      responses: {
        "201": {
          content: {
            "application/json": {
              schema: schemaRef(fileResponseSchema),
            },
          },
          description: "File created from completed upload.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamStorageResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Complete file upload",
      tags: [tagRef(filesTag)],
    },
  },
  "/files": {
    get: {
      operationId: "listFiles",
      parameters: [
        {
          in: "query",
          name: "limit",
          required: false,
          schema: {
            default: 50,
            maximum: 100,
            minimum: 1,
            type: "integer",
          },
        },
        {
          in: "query",
          name: "cursor",
          required: false,
          schema: {
            minLength: 1,
            type: "string",
          },
        },
        {
          in: "query",
          name: "status",
          required: false,
          schema: {
            enum: FILE_STATUS_ACCEPTED_VALUES as unknown as string[],
            type: "string",
          },
        },
        {
          in: "query",
          name: "purpose",
          required: false,
          schema: {
            enum: [...PUBLIC_FILE_PURPOSE_ACCEPTED_VALUES],
            type: "string",
          },
        },
      ],
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(listFilesResponseSchema),
            },
          },
          description: "Files for current user.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamStorageResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "List files",
      tags: [tagRef(filesTag)],
    },
  },

  "/files/{fileId}": {
    delete: {
      operationId: "deleteFile",
      responses: {
        "204": {
          description: "File deletion requested.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamStorageResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Delete file",
      tags: [tagRef(filesTag)],
    },
    get: {
      operationId: "getFile",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(fileResponseSchema),
            },
          },
          description: "File.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamStorageResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Get file",
      tags: [tagRef(filesTag)],
    },
    parameters: [paramRef(fileParam)],
    patch: {
      operationId: "updateFile",
      requestBody: {
        content: {
          "application/json": {
            schema: schemaRef(updateFileRequestSchema),
          },
        },
        required: true,
      },
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(fileResponseSchema),
            },
          },
          description: "File updated.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamStorageResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Update file metadata",
      tags: [tagRef(filesTag)],
    },
  },

  "/files/{fileId}/download-urls": {
    parameters: [paramRef(fileParam)],
    post: {
      operationId: "createFileDownloadUrl",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: schemaRef(createFileDownloadUrlResponseSchema),
            },
          },
          description: "File download URL.",
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamStorageResponse),
      },
      security: [keycloakSecurityRequirement],
      summary: "Create file download URL",
      tags: [tagRef(filesTag)],
    },
  },
});

export const openapi: OpenAPI = {
  components: {
    parameters: Object.fromEntries(
      params.map((param) => [param.name, param.schema]),
    ),
    responses: Object.fromEntries([
      ...responses.map((resp) => [resp.name, resp.schema]),
      [unauthorizedResponse.name, unauthorizedResponse.schema],
    ]),
    schemas: Object.fromEntries([
      ...schemas.map((schema) => [schema.name, schema.schema]),
      [errorResponseSchema.name, errorResponseSchema.schema],
    ]),
    securitySchemes: Object.fromEntries([
      [keycloakSecurityScheme.name, keycloakSecurityScheme.securitySchema],
    ]),
  },
  info: {
    title: "Lemma Files API",
    version: "0.1.0",
  },
  openapi: "3.1.0",
  paths,
  tags: [filesTag],
};
