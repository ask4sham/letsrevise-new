/**
 * Object storage policy: Supabase Storage and/or Cloudflare R2 are implemented in
 * services/supabaseStorage.js and services/r2Storage.js.
 *
 * REQUIRE_CLOUD_UPLOADS — when truthy, failed cloud uploads do not fall back to local disk.
 *   Recommended for production (Render, etc.) once env vars are set.
 *   Automatically disabled during NODE_ENV=test so integration tests keep using local disk.
 *
 * Env (see also r2Storage.js / supabaseStorage.js):
 *   Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_MEDIA_BUCKET
 *   R2: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 */

function isTruthyEnv(name) {
  const v = String(process.env[name] || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * When false, image/video/admin/diagram uploads may write under FILE_STORAGE_PATH.
 * When true (REQUIRE_CLOUD_UPLOADS), cloud upload must succeed or the request fails.
 */
function allowLocalUploadFallback() {
  if (process.env.NODE_ENV === "test") return true;
  return !isTruthyEnv("REQUIRE_CLOUD_UPLOADS");
}

function cloudUploadRequiredMessage() {
  return (
    "Cloud storage is required (REQUIRE_CLOUD_UPLOADS) but the upload failed. " +
    "Check Supabase Storage and/or R2 credentials and bucket policy."
  );
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

/**
 * Log when an upload is written under FILE_STORAGE_PATH or public/ while running in production.
 * Does not throw — use alongside REQUIRE_CLOUD_UPLOADS for hard enforcement.
 */
function warnLocalDiskFallback(context) {
  if (!isProductionEnvironment()) return;
  console.warn(
    `[storage] WARNING: local disk write (${context}). ` +
      "Configure Supabase Storage and/or R2; set REQUIRE_CLOUD_UPLOADS=true to block fallback."
  );
}

module.exports = {
  allowLocalUploadFallback,
  cloudUploadRequiredMessage,
  isTruthyEnv,
  isProductionEnvironment,
  warnLocalDiskFallback,
};
