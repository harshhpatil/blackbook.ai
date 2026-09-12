import crypto from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as getAwsSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET_NAME;
const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
  throw new Error("Missing Cloudflare R2 configuration");
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

export function createEngineKey(kind, filename = "bin") {
  const extension = filename.includes(".") ? `.${filename.split(".").pop().replace(/[^a-z0-9]/gi, "")}` : "";
  return `template-engine/${kind}/${crypto.randomUUID()}${extension}`;
}

export async function putObject(key, body, contentType) {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function getObjectBuffer(key) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error("R2 object body is missing");
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function getSignedUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getAwsSignedUrl(client, command, { expiresIn });
}
