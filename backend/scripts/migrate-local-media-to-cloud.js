#!/usr/bin/env node
/**
 * Upload existing files from FILE_STORAGE_PATH (backend/uploads) to Supabase/R2 using the same
 * object keys as the app (folder/filename). Run from repo with backend/.env loaded.
 *
 * Priority matches runtime: Supabase first, then R2 (via uploadObjectStorage.tryPutBuffer).
 *
 * Env:
 *   DRY_RUN=1 (default) — only list files; set DRY_RUN=0 to upload
 *   LIMIT=N — process at most N files (default unlimited)
 *
 * After migration, update DB lesson URLs from /uploads/... to public URLs if needed, then
 * archive or delete local copies when confident.
 *
 * Usage:
 *   cd backend && node scripts/migrate-local-media-to-cloud.js
 *   cd backend && DRY_RUN=0 node scripts/migrate-local-media-to-cloud.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const { FILE_STORAGE_PATH } = require("../config/paths");
const { tryPutBuffer } = require("../services/uploadObjectStorage");
const { isSupabaseStorageEnabled } = require("../services/supabaseStorage");
const { isR2Enabled } = require("../services/r2Storage");
const { guessContentType } = require("./migrationContentTypes");

const DRY_RUN = process.env.DRY_RUN !== "0";
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

function walkFiles(absDir, baseAbs, out) {
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(absDir, e.name);
    if (e.isDirectory()) {
      walkFiles(full, baseAbs, out);
    } else if (e.isFile()) {
      const rel = path.relative(baseAbs, full).replace(/\\/g, "/");
      out.push({ full, rel });
    }
  }
}

/** Match app keys: nested paths as-is; files at uploads root become `uploads/<file>` (admin media). */
function objectKeyFromStorageRel(rel) {
  const r = rel.replace(/\\/g, "/");
  if (r.includes("/")) return r;
  return `uploads/${r}`;
}

async function main() {
  if (!isSupabaseStorageEnabled() && !isR2Enabled()) {
    console.error("Neither Supabase nor R2 is configured. Set env vars (see config/storage.js).");
    process.exit(1);
  }

  const base = path.resolve(FILE_STORAGE_PATH);
  const files = [];
  walkFiles(base, base, files);

  console.log(`Found ${files.length} file(s) under ${base}`);
  console.log(`DRY_RUN=${DRY_RUN} LIMIT=${Number.isFinite(LIMIT) ? LIMIT : "∞"}`);

  let done = 0;
  for (const { full, rel } of files) {
    if (done >= LIMIT) break;
    const key = objectKeyFromStorageRel(rel);
    if (DRY_RUN) {
      console.log(`[dry-run] would upload key=${key}`);
      done += 1;
      continue;
    }

    const buf = fs.readFileSync(full);
    const ct = guessContentType(full);
    const result = await tryPutBuffer(buf, key, ct);
    if (result) {
      console.log(`[ok] ${key} -> ${result.storage} ${result.url.slice(0, 72)}...`);
    } else {
      console.error(`[fail] ${key} — cloud upload returned null`);
    }
    done += 1;
  }

  if (DRY_RUN) {
    console.log("\nSet DRY_RUN=0 to perform uploads. Review keys above match your bucket layout.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
