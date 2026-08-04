import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.ts';

const s3 = new S3Client({
  region: env.AWS_S3_REGION,
  endpoint: env.AWS_S3_ENDPOINT,
  forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY,
    secretAccessKey: env.AWS_SECRET_KEY,
  },
});

export const createAssetKey = (
  userId: string,
  kind: string,
  extension: string,
  projectId?: string
): string => {
  const safeExtension = extension.replace(/[^a-z0-9.]/gi, '').toLowerCase();
  const prefix = projectId ? `users/${userId}/projects/${projectId}` : `users/${userId}`;
  return `${prefix}/${kind}/${crypto.randomUUID()}${safeExtension}`;
};

export async function uploadAsset(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getAssetStream(key: string): Promise<Readable> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET_NAME, Key: key })
  );

  if (!response.Body || !(response.Body instanceof Readable)) {
    throw new Error('Storage object did not include a readable body');
  }

  return response.Body;
}

export async function deleteAsset(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET_NAME, Key: key })
  );
}
