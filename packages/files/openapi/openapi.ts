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
  FILE_PURPOSE_ACCEPTED_VALUES,
  FILE_STATUS_ACCEPTED_VALUES,
  FILE_UPLOAD_STATUS_ACCEPTED_VALUES,
  MAX_FILE_BYTE_SIZE,
  MAX_ORIGINAL_FILE_NAME_LENGTH,
} from "../src/domain/index.ts";

const filesTag: Tag = {
  name: "Files",
  description: "File upload, file metadata, and file download URL operations.",
};

const fileSchema: Schema = {
  name: "File",
  schema: {
    type: "object",
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
    properties: {
      id: {
        ...uuidV7StringSchemaObject(),
      },
      ownerUserId: {
        ...uuidV7StringSchemaObject(),
      },
      createdByUserId: {
        ...uuidV7StringSchemaObject(),
      },
      originalName: {
        type: "string",
        minLength: 1,
        maxLength: MAX_ORIGINAL_FILE_NAME_LENGTH,
        example: "workbook.xlsx",
      },
      contentType: {
        type: "string",
        enum: FILE_CONTENT_TYPE_ACCEPTED_VALUES as unknown as string[],
        example:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      byteSize: {
        type: "integer",
        exclusiveMinimum: 0,
        maximum: MAX_FILE_BYTE_SIZE,
        example: 1024,
      },
      checksumSha256: {
        type: "string",
        pattern: "^[A-Fa-f0-9]{64}$",
        example:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
      status: {
        type: "string",
        enum: FILE_STATUS_ACCEPTED_VALUES as unknown as string[],
        example: "uploaded",
      },
      purpose: {
        type: "string",
        enum: FILE_PURPOSE_ACCEPTED_VALUES as unknown as string[],
        example: "workbook",
      },
      deletedAt: {
        type: ["string", "null"],
        format: "date-time",
      },
      createdAt: {
        type: "string",
        format: "date-time",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
      },
    },
  },
};

const fileUploadSchema: Schema = {
  name: "FileUpload",
  schema: {
    type: "object",
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
    properties: {
      id: {
        ...uuidV7StringSchemaObject(),
      },
      createdByUserId: {
        ...uuidV7StringSchemaObject(),
      },
      originalName: {
        type: "string",
        minLength: 1,
        maxLength: MAX_ORIGINAL_FILE_NAME_LENGTH,
        example: "workbook.xlsx",
      },
      contentType: {
        type: "string",
        enum: FILE_CONTENT_TYPE_ACCEPTED_VALUES as unknown as string[],
        example:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      expectedByteSize: {
        type: "integer",
        exclusiveMinimum: 0,
        maximum: MAX_FILE_BYTE_SIZE,
        example: 1024,
      },
      checksumSha256: {
        type: "string",
        pattern: "^[A-Fa-f0-9]{64}$",
        example:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
      status: {
        type: "string",
        enum: FILE_UPLOAD_STATUS_ACCEPTED_VALUES as unknown as string[],
        example: "initiated",
      },
      purpose: {
        type: "string",
        enum: FILE_PURPOSE_ACCEPTED_VALUES as unknown as string[],
        example: "workbook",
      },
      uploadExpiresAt: {
        type: "string",
        format: "date-time",
      },
      completedAt: {
        type: ["string", "null"],
        format: "date-time",
      },
      createdAt: {
        type: "string",
        format: "date-time",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
      },
    },
  },
};

const listFilesResponseSchema: Schema = {
  name: "ListFilesResponse",
  schema: {
    type: "object",
    required: ["files", "nextCursor"],
    properties: {
      files: {
        type: "array",
        items: schemaRef(fileSchema),
      },
      nextCursor: {
        type: ["string", "null"],
        minLength: 1,
      },
    },
  },
};

const fileResponseSchema: Schema = {
  name: "FileResponse",
  schema: {
    type: "object",
    required: ["file"],
    properties: {
      file: schemaRef(fileSchema),
    },
  },
};

const fileUploadUrlSchema: Schema = {
  name: "FileUploadUrl",
  schema: {
    type: "object",
    required: ["url", "method", "expiresInSeconds", "headers"],
    properties: {
      url: {
        type: "string",
        format: "uri",
      },
      method: {
        type: "string",
        enum: ["PUT"],
      },
      expiresInSeconds: {
        type: "integer",
        exclusiveMinimum: 0,
      },
      headers: {
        type: "object",
        required: ["Content-Type", "x-amz-checksum-sha256"],
        properties: {
          "Content-Type": {
            type: "string",
          },
          "x-amz-checksum-sha256": {
            type: "string",
          },
        },
      },
    },
  },
};

const fileDownloadUrlSchema: Schema = {
  name: "FileDownloadUrl",
  schema: {
    type: "object",
    required: ["url", "method", "expiresInSeconds"],
    properties: {
      url: {
        type: "string",
        format: "uri",
      },
      method: {
        type: "string",
        enum: ["GET"],
      },
      expiresInSeconds: {
        type: "integer",
        exclusiveMinimum: 0,
      },
    },
  },
};

const createFileUploadResponseSchema: Schema = {
  name: "CreateFileUploadResponse",
  schema: {
    type: "object",
    required: ["upload", "uploadUrl"],
    properties: {
      upload: schemaRef(fileUploadSchema),
      uploadUrl: schemaRef(fileUploadUrlSchema),
    },
  },
};

const createFileDownloadUrlResponseSchema: Schema = {
  name: "CreateFileDownloadUrlResponse",
  schema: {
    type: "object",
    required: ["download"],
    properties: {
      download: schemaRef(fileDownloadUrlSchema),
    },
  },
};

const createFileUploadRequestSchema: Schema = {
  name: "CreateFileUploadRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "originalName",
      "contentType",
      "byteSize",
      "checksumSha256",
      "purpose",
    ],
    properties: {
      originalName: {
        type: "string",
        minLength: 1,
        maxLength: MAX_ORIGINAL_FILE_NAME_LENGTH,
      },
      contentType: {
        type: "string",
        enum: FILE_CONTENT_TYPE_ACCEPTED_VALUES as unknown as string[],
      },
      byteSize: {
        type: "integer",
        exclusiveMinimum: 0,
        maximum: MAX_FILE_BYTE_SIZE,
      },
      checksumSha256: {
        type: "string",
        pattern: "^[A-Fa-f0-9]{64}$",
      },
      purpose: {
        type: "string",
        enum: FILE_PURPOSE_ACCEPTED_VALUES as unknown as string[],
      },
    },
  },
};

const updateFileRequestSchema: Schema = {
  name: "UpdateFileRequest",
  schema: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      originalName: {
        type: "string",
        minLength: 1,
        maxLength: MAX_ORIGINAL_FILE_NAME_LENGTH,
      },
      purpose: {
        type: "string",
        enum: FILE_PURPOSE_ACCEPTED_VALUES as unknown as string[],
      },
    },
  },
};

const upstreamStorageResponse: Response = {
  name: "UpstreamStorage",
  schema: {
    description: "Storage provider operation failed.",
    content: {
      "application/json": {
        schema: schemaRef(errorResponseSchema),
      },
    },
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
  "/files": {
    get: {
      tags: [tagRef(filesTag)],
      summary: "List files",
      operationId: "listFiles",
      security: [keycloakSecurityRequirement],
      parameters: [
        {
          name: "limit",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 50,
          },
        },
        {
          name: "cursor",
          in: "query",
          required: false,
          schema: {
            type: "string",
            minLength: 1,
          },
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: FILE_STATUS_ACCEPTED_VALUES as unknown as string[],
          },
        },
        {
          name: "purpose",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: FILE_PURPOSE_ACCEPTED_VALUES as unknown as string[],
          },
        },
      ],
      responses: {
        "200": {
          description: "Files for current user.",
          content: {
            "application/json": {
              schema: schemaRef(listFilesResponseSchema),
            },
          },
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamStorageResponse),
      },
    },
  },

  "/file-uploads": {
    post: {
      tags: [tagRef(filesTag)],
      summary: "Create file upload",
      operationId: "createFileUpload",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(createFileUploadRequestSchema),
          },
        },
      },
      responses: {
        "201": {
          description: "File upload session created.",
          content: {
            "application/json": {
              schema: schemaRef(createFileUploadResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "502": responseRef(upstreamStorageResponse),
      },
    },
  },

  "/files/{fileId}": {
    parameters: [paramRef(fileParam)],
    get: {
      tags: [tagRef(filesTag)],
      summary: "Get file",
      operationId: "getFile",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "File.",
          content: {
            "application/json": {
              schema: schemaRef(fileResponseSchema),
            },
          },
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamStorageResponse),
      },
    },
    patch: {
      tags: [tagRef(filesTag)],
      summary: "Update file metadata",
      operationId: "updateFile",
      security: [keycloakSecurityRequirement],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: schemaRef(updateFileRequestSchema),
          },
        },
      },
      responses: {
        "200": {
          description: "File updated.",
          content: {
            "application/json": {
              schema: schemaRef(fileResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamStorageResponse),
      },
    },
    delete: {
      tags: [tagRef(filesTag)],
      summary: "Delete file",
      operationId: "deleteFile",
      security: [keycloakSecurityRequirement],
      responses: {
        "204": {
          description: "File deletion requested.",
        },
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "502": responseRef(upstreamStorageResponse),
      },
    },
  },

  "/files/{fileId}/download-urls": {
    parameters: [paramRef(fileParam)],
    post: {
      tags: [tagRef(filesTag)],
      summary: "Create file download URL",
      operationId: "createFileDownloadUrl",
      security: [keycloakSecurityRequirement],
      responses: {
        "200": {
          description: "File download URL.",
          content: {
            "application/json": {
              schema: schemaRef(createFileDownloadUrlResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamStorageResponse),
      },
    },
  },

  "/file-uploads/{uploadId}/completions": {
    parameters: [paramRef(fileUploadParam)],
    post: {
      tags: [tagRef(filesTag)],
      summary: "Complete file upload",
      operationId: "completeFileUpload",
      security: [keycloakSecurityRequirement],
      responses: {
        "201": {
          description: "File created from completed upload.",
          content: {
            "application/json": {
              schema: schemaRef(fileResponseSchema),
            },
          },
        },
        "400": responseRef(badRequestResponse),
        "401": responseRef(unauthorizedResponse),
        "403": responseRef(forbiddenResponse),
        "404": responseRef(notFoundResponse),
        "409": responseRef(conflictResponse),
        "502": responseRef(upstreamStorageResponse),
      },
    },
  },
});

export const openapi: OpenAPI = {
  openapi: "3.1.0",
  info: {
    title: "Lemma Files API",
    version: "0.1.0",
  },
  tags: [filesTag],
  components: {
    securitySchemes: Object.fromEntries([
      [keycloakSecurityScheme.name, keycloakSecurityScheme.securitySchema],
    ]),
    parameters: Object.fromEntries(
      params.map((param) => [param.name, param.schema]),
    ),
    schemas: Object.fromEntries([
      ...schemas.map((schema) => [schema.name, schema.schema]),
      [errorResponseSchema.name, errorResponseSchema.schema],
    ]),
    responses: Object.fromEntries([
      ...responses.map((resp) => [resp.name, resp.schema]),
      [unauthorizedResponse.name, unauthorizedResponse.schema],
    ]),
  },
  paths,
};
