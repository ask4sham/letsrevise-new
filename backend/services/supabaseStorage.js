/**
 * Supabase Storage — persistent cloud storage for lesson media.
 * Uses existing Supabase project; bucket configurable via SUPABASE_MEDIA_BUCKET.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY), SUPABASE_MEDIA_BUCKET
 * When configured, uploads go to Supabase Storage and return public URL.
 */
const { supabaseAdmin } = require("../routes/supabaseAdmin");

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "lesson-media";

function isSupabaseStorageEnabled() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return !!(url && key && supabaseAdmin && typeof supabaseAdmin.storage?.from === "function");
}

/**
 * Strip leading bucket name from path to avoid duplication in public URL.
 * Frontend sends folder like "lesson-media/lesson_xxx/..." — bucket is "lesson-media",
 * so object key should be "lesson_xxx/..." not "lesson-media/lesson_xxx/..."
 */
function objectKeyForBucket(storagePath, bucket) {
  const p = (storagePath || "").replace(/\\/g, "/").trim();
  const prefix = bucket + "/";
  if (p.startsWith(prefix)) return p.slice(prefix.length);
  if (p === bucket) return "";
  return p;
}

/**
 * Upload buffer to Supabase Storage.
 * storagePath from uploads.js may include bucket prefix (e.g. lesson-media/lesson_xxx/...);
 * we strip it so the object key is lesson_xxx/... and the public URL is correct.
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} storagePath - Full path (folder/filename), may start with bucket name
 * @param {string} contentType - MIME type
 * @returns {Promise<string|null>} Public URL or null
 */
async function uploadToSupabase(buffer, storagePath, contentType) {
  if (!isSupabaseStorageEnabled()) return null;
  if (!supabaseAdmin || typeof supabaseAdmin.storage?.from !== "function") {
    return null;
  }

  const objectKey = objectKeyForBucket(storagePath, BUCKET) || storagePath.replace(/\\/g, "/");

  try {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectKey, buffer, {
        contentType: contentType || "image/png",
        upsert: true,
      });

    if (error) {
      console.error("[supabase-storage] Upload error:", error.message, "| bucket:", BUCKET, "| key:", objectKey);
      return null;
    }

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectKey);
    const url = data?.publicUrl || null;
    if (url) console.log("[supabase-storage] Upload OK:", url.slice(0, 80) + "...");
    return url;
  } catch (err) {
    console.error("[supabase-storage] Error:", err.message, err.stack);
    return null;
  }
}

module.exports = {
  uploadToSupabase,
  isSupabaseStorageEnabled,
  BUCKET,
};
