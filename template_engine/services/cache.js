import crypto from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.R2_BUCKET_NAME;

function cacheKey(namespace, value) {
  return `template-engine/cache/${namespace}/${crypto.createHash('sha256').update(String(value).trim()).digest('hex')}.json`;
}

export async function getCachedResult(namespace, value) {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: cacheKey(namespace, value) }));
    return JSON.parse(await response.Body.transformToString());
  } catch {
    return null;
  }
}

export async function setCachedResult(namespace, value, data) {
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: cacheKey(namespace, value),
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    }));
  } catch (error) {
    console.warn('R2 cache write warning:', error.message);
  }
}
