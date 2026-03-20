/**
 * Cloudflare R2 storage — persistent cloud storage for lesson media.
 * R2 is S3-compatible; we use @aws-sdk/client-s3.
 *
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 * When R2_PUBLIC_URL is set, uploads go to R2 and return public URL.
 * When not set, uploads fall back to local disk (existing behavior).
 */
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL; // e.g. https://pub-xxx.r2.dev or https://media.letsrevise.com

  const configured =
    accountId && accessKeyId && secretAccessKey && bucketName && publicUrl;

  return {
    configured,
    bucketName: bucketName || "letsrevise-media",
    publicUrl: (publicUrl || "").replace(/\/$/, ""),
  };
}

let s3Client = null;

function getR2Client() {
  if (s3Client) return s3Client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
  return s3Client;
}

/**
 * Upload buffer to R2. Returns public URL or null on failure.
 * @param {Buffer} buffer - File buffer
 * @param {string} key - Object key (e.g. lesson-media/lesson_xxx/page_yyy/block_1/image-123.png)
 * @param {string} contentType - MIME type
 * @returns {Promise<string|null>} Public URL or null
 */
async function uploadToR2(buffer, key, contentType) {
  const config = getR2Config();
  if (!config.configured) return null;

  const client = getR2Client();
  if (!client) return null;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
      })
    );
    return `${config.publicUrl}/${key}`;
  } catch (err) {
    console.error("[r2] Upload error:", err.message);
    return null;
  }
}

/**
 * Check if R2 is configured and should be used for uploads.
 */
function isR2Enabled() {
  return !!getR2Config().configured;
}

module.exports = {
  getR2Config,
  uploadToR2,
  isR2Enabled,
};
