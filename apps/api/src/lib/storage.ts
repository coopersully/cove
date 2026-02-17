import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface StorageService {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
}

function createS3Storage(): StorageService {
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const hasStaticCredentials = Boolean(accessKeyId) && Boolean(secretAccessKey);

  const client = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
    ...(hasStaticCredentials && accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }
      : {}),
    forcePathStyle: true, // Required for MinIO
  });

  const bucket = process.env.S3_BUCKET ?? "cove-uploads";

  return {
    async upload(key, buffer, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      if (process.env.S3_ENDPOINT) {
        return `${process.env.S3_ENDPOINT}/${bucket}/${key}`;
      }
      return `https://${bucket}.s3.${process.env.S3_REGION ?? "us-east-1"}.amazonaws.com/${key}`;
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

function createLocalStorage(): StorageService {
  const uploadDir = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";

  return {
    async upload(key, buffer, _contentType) {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { dirname, join } = await import("node:path");
      const filePath = join(uploadDir, key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, buffer);
      return `/uploads/${key}`;
    },
    async delete(key) {
      const { unlink } = await import("node:fs/promises");
      const { join } = await import("node:path");
      try {
        await unlink(join(uploadDir, key));
      } catch {
        // File may not exist
      }
    },
  };
}

let storageInstance: StorageService | undefined;

export function getStorage(): StorageService {
  if (!storageInstance) {
    storageInstance =
      process.env.STORAGE_BACKEND === "s3" ? createS3Storage() : createLocalStorage();
  }
  return storageInstance;
}
