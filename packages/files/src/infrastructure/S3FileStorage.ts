import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { instrumentExternal } from "@lemma/observability";
import type { FileStorage } from "../application/index.js";
import { FileStorageProviderError } from "../domain/index.js";

export type S3FileStorageConfig = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  publicEndpoint: string;
  forcePathStyle: boolean;
  uploadUrlExpiresInSeconds: number;
  downloadUrlExpiresInSeconds: number;
};

const instrumentation = instrumentExternal("files", "s3");

export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly presignClient: S3Client;
  private readonly uploadUrlExpiresInSeconds: number;
  private readonly downloadUrlExpiresInSeconds: number;

  constructor(config: S3FileStorageConfig) {
    const credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
    const commonConfig = {
      credentials,
      forcePathStyle: config.forcePathStyle,
      region: config.region,
    };

    this.client = new S3Client({
      ...commonConfig,
      endpoint: config.endpoint,
    });
    this.presignClient = new S3Client({
      ...commonConfig,
      endpoint: config.publicEndpoint,
    });
    this.uploadUrlExpiresInSeconds = config.uploadUrlExpiresInSeconds;
    this.downloadUrlExpiresInSeconds = config.downloadUrlExpiresInSeconds;
  }

  createUploadUrl(input: {
    bucket: string;
    key: string;
    contentType: string;
    checksumSha256: string;
  }): Promise<string> {
    return this.storageOperation("create_upload_url", () =>
      getSignedUrl(
        this.presignClient,
        new PutObjectCommand({
          Bucket: input.bucket,
          ChecksumSHA256: sha256HexToBase64(input.checksumSha256),
          ContentType: input.contentType,
          Key: input.key,
        }),
        {
          expiresIn: this.uploadUrlExpiresInSeconds,
          unhoistableHeaders: new Set(["x-amz-checksum-sha256"]),
        },
      ),
    );
  }

  createDownloadUrl(input: { bucket: string; key: string }): Promise<string> {
    return this.storageOperation("create_download_url", () =>
      getSignedUrl(
        this.presignClient,
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
        { expiresIn: this.downloadUrlExpiresInSeconds },
      ),
    );
  }

  getObjectMetadata(input: { bucket: string; key: string }): Promise<{
    byteSize?: number;
    checksumSha256?: string;
    contentType?: string;
  } | null> {
    return this.storageOperation("get_object_metadata", async () => {
      try {
        const result = await this.client.send(
          new HeadObjectCommand({
            Bucket: input.bucket,
            ChecksumMode: "ENABLED",
            Key: input.key,
          }),
        );

        return {
          byteSize: result.ContentLength,
          checksumSha256: result.ChecksumSHA256
            ? sha256Base64ToHex(result.ChecksumSHA256)
            : undefined,
          contentType: result.ContentType,
        };
      } catch (error) {
        if (
          error instanceof S3ServiceException &&
          (error.$metadata.httpStatusCode === 404 ||
            error.name === "NotFound" ||
            error.name === "NoSuchKey")
        ) {
          return null;
        }
        throw error;
      }
    });
  }

  getObjectBytes(input: { bucket: string; key: string }): Promise<Uint8Array> {
    return this.storageOperation("get_object_bytes", async () => {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
      );

      if (!result.Body) {
        throw new FileStorageProviderError("storage object body is empty");
      }

      return result.Body.transformToByteArray();
    });
  }

  deleteObject(input: { bucket: string; key: string }): Promise<void> {
    return this.storageOperation("delete_object", async () => {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
      );
    });
  }

  private async storageOperation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(
      operation,
      {
        attributes: { "storage.system": "s3" },
      },
      () => this.withStorageError(fn),
    );
  }

  private async withStorageError<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (cause) {
      throw new FileStorageProviderError("storage provider operation failed", {
        cause,
      });
    }
  }
}

function sha256HexToBase64(value: string): string {
  return Buffer.from(value, "hex").toString("base64");
}

function sha256Base64ToHex(value: string): string {
  return Buffer.from(value, "base64").toString("hex");
}
