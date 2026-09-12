import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('storage-service');

/**
 * Singleton AWS S3 Client instance configured for Cloudflare R2.
 */
const r2 = new S3Client({
  // Cloudflare R2 strictly requires the region to be 'auto'
  region: 'auto',
  // R2 endpoint format: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID ?? env.R2_ACCESS_KEY!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * Generates a collision-resistant, strictly formatted R2 object key.
 * 
 * @param userId - The ID of the user uploading the file.
 * @param kind - The category of the asset (e.g., 'template', 'export-pdf').
 * @param extension - The file extension (e.g., '.png', '.pdf').
 * @param projectId - Optional project ID for scoping assets to specific projects.
 * @returns A strictly formatted string for the R2 Key.
 */
export const createAssetKey = (
  userId: string,
  kind: string,
  extension: string,
  projectId?: string
): string => {
  // Strip out any potentially dangerous characters from the extension
  const safeExtension = extension.replace(/[^a-z0-9.]/gi, '').toLowerCase();
  const prefix = projectId
    ? `users/${userId}/projects/${projectId}`
    : `users/${userId}`;

  return `${prefix}/${kind}/${crypto.randomUUID()}${safeExtension}`;
};

/**
 * Uploads a buffer to the configured Cloudflare R2 bucket.
 */
export async function uploadAsset(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );

    log.info({ key, contentType }, 'Asset uploaded successfully to R2');
  } catch (error) {
    log.error({ key, error }, 'Failed to upload asset to R2');
    throw new Error('Storage upload failed', { cause: error });
  }
}

/**
 * Retrieves an asset from Cloudflare R2 as a Node.js Readable stream.
 * Ideal for piping directly to the Express Response object to minimize memory usage.
 */
export async function getAssetStream(key: string): Promise<Readable> {
  try {
    const response = await r2.send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key
      })
    );

    if (!response.Body || !(response.Body instanceof Readable)) {
      throw new Error('R2 response body is missing or is not a readable stream');
    }

    return response.Body;
  } catch (error) {
    log.error({ key, error }, 'Failed to retrieve asset stream from R2');
    throw new Error('Storage retrieval failed', { cause: error });
  }
}

export async function getAssetBuffer(key: string): Promise<Buffer> {
  const response = await r2.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })
  );
  if (!response.Body) throw new Error('R2 response body is missing');
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function getAssetDownloadUrl(key: string, expiresIn = 900): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
    { expiresIn }
  );
}

/**
 * Deletes an asset from the configured Cloudflare R2 bucket.
 */
export async function deleteAsset(key: string): Promise<void> {
  try {
    await r2.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key
      })
    );

    log.info({ key }, 'Asset deleted successfully from R2');
  } catch (error) {
    log.error({ key, error }, 'Failed to delete asset from R2');
    throw new Error('Storage deletion failed', { cause: error });
  }
}