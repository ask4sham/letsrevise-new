/**
 * Central object-upload path for user-generated media (images, PDFs, videos as buffers).
 *
 * Priority (single source of truth — do not duplicate elsewhere):
 *   1. Supabase Storage (if SUPABASE_URL + service key + bucket)
 *   2. Cloudflare R2 / S3-compatible (if R2_* env complete)
 *   3. Local disk — only when allowLocalUploadFallback() is true (see config/storage.js)
 *
 * REQUIRE_CLOUD_UPLOADS=true disables step 3 and causes callers to error if 1+2 fail.
 */
const { uploadToR2, isR2Enabled } = require("./r2Storage");
const { uploadToSupabase, isSupabaseStorageEnabled } = require("./supabaseStorage");

/**
 * @param {Buffer} buffer
 * @param {string} storagePath - Object key (e.g. uploads/ab12...png, lesson-media/foo.png, visuals/biology/...)
 * @param {string} contentType
 * @returns {Promise<{ url: string, storage: string } | null>}
 */
async function tryPutBuffer(buffer, storagePath, contentType) {
  if (isSupabaseStorageEnabled()) {
    const url = await uploadToSupabase(buffer, storagePath, contentType);
    if (url) return { url, storage: "supabase" };
  }
  if (isR2Enabled()) {
    const url = await uploadToR2(buffer, storagePath, contentType);
    if (url) return { url, storage: "r2" };
  }
  return null;
}

module.exports = {
  tryPutBuffer,
};
