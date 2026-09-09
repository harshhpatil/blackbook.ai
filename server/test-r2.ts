// test-r2.ts
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  S3Client,
  ListBucketsCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, ".env") });

const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || process.env.AWS_BUCKET_NAME;
const endpoint =
  process.env.R2_ENDPOINT ||
  (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

console.log("=== R2 / S3 Configuration Check ===");
console.log({
  endpoint,
  bucketName,
  accessKeyId: accessKeyId ? `${accessKeyId.slice(0, 5)}...` : undefined,
  hasSecret: !!secretAccessKey,
});

if (!accessKeyId || !secretAccessKey || !bucketName) {
  console.error("\n❌ Missing required environment variables in .env!");
  process.exit(1);
}

const s3Client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function runDiagnostic() {
  // Test 1: Validate Authentication / List Buckets
  console.log("\n--- Step 1: Testing Connection & Authentication ---");
  try {
    const listRes = await s3Client.send(new ListBucketsCommand({}));
    console.log("✅ Authentication successful!");
    console.log(
      "Visible Buckets:",
      listRes.Buckets?.map((b) => b.Name) ?? []
    );
  } catch (err: any) {
    console.error("❌ Failed at ListBuckets:");
    console.error(`Name: ${err.name}, Code: ${err.Code}, Status: ${err.$metadata?.httpStatusCode}`);
    console.error(`Message: ${err.message}`);
    console.log("💡 Tip: If your token was generated with Single Bucket permissions, ListBuckets will fail with 403. Moving to PutObject test...");
  }

  // Test 2: Test Write Permission (PutObject)
  const testKey = `test-diagnostics-${Date.now()}.txt`;
  console.log(`\n--- Step 2: Testing Write Permission on Bucket "${bucketName}" ---`);
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: Buffer.from("Hello R2 test write"),
        ContentType: "text/plain",
      })
    );
    console.log(`✅ PutObject succeeded! Created test key: ${testKey}`);
  } catch (err: any) {
    console.error("❌ Failed at PutObject (Write):");
    console.error(`Status: ${err.$metadata?.httpStatusCode}`);
    console.error(`Error Name: ${err.name}`);
    console.error(`Message: ${err.message}`);
    console.error("\n🔍 Likely Causes for AccessDenied (403):");
    console.error("1. The API token in Cloudflare Dashboard only has 'Object Read' permission instead of 'Object Read & Write' (or 'Admin Read & Write').");
    console.error("2. The R2 bucket name in your .env doesn't match the bucket assigned to the API token.");
    console.error("3. The Account ID in your endpoint URL is incorrect.");
    return;
  }

  // Test 3: Cleanup Test File
  console.log("\n--- Step 3: Cleaning up test object ---");
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      })
    );
    console.log("✅ Cleanup succeeded!");
  } catch (err: any) {
    console.warn(`⚠️ Cleanup failed: ${err.message}`);
  }

  console.log("\n🎉 Diagnostic Complete: R2 write credentials are fully functional!");
}

runDiagnostic();