#!/usr/bin/env node
/**
 * Upload files under backend/public/visuals to Supabase or R2, preserving path structure:
 *   local:  backend/public/visuals/biology/aqa-gcse/foo.png
 *   key:    visuals/biology/aqa-gcse/foo.png
 *   URL:    <R2_PUBLIC_URL or Supabase public>/visuals/biology/aqa-gcse/foo.png
 *
 * Priority matches runtime: Supabase → R2 (uploadObjectStorage.tryPutBuffer).
 *
 * Env:
 *   DRY_RUN=1 (default) — list only; DRY_RUN=0 to upload
 *   LIMIT=N — max files
 *   VISUALS_MIGRATION_MANIFEST=path — optional JSON file to append { key, url, rel } per successful upload
 *
 * Frontend: set REACT_APP_PUBLIC_VISUALS_CDN_URL to your public bucket base (e.g. R2_PUBLIC_URL)
 * so /visuals/... resolves to the same objects.
 *
 * Backend: optional SERVE_LOCAL_PUBLIC_VISUALS=false after CDN works.
 *
 * Usage:
 *   cd backend && node scripts/migrate-public-visuals-to-cloud.js
 *   cd backend && DRY_RUN=0 node scripts/migrate-public-visuals-to-cloud.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const { PUBLIC_VISUALS_DIR } = require("../config/paths");
const { tryPutBuffer } = require("../services/uploadObjectStorage");
const { isSupabaseStorageEnabled } = require("../services/supabaseStorage");
const { isR2Enabled } = require("../services/r2Storage");
const { guessContentType } = require("./migrationContentTypes");

const DRY_RUN = process.env.DRY_RUN !== "0";
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
const MANIFEST_PATH = process.env.VISUALS_MIGRATION_MANIFEST
  ? path.resolve(process.env.VISUALS_MIGRATION_MANIFEST)
  : null;

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

/** Object key and public URL path segment: visuals/<relative-from-public/visuals> */
function objectKeyFromVisualsRel(rel) {
  const r = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  return `visuals/${r}`;
}

async function main() {
  if (!isSupabaseStorageEnabled() && !isR2Enabled()) {
    console.error("Neither Supabase nor R2 is configured. Set env vars (see config/storage.js).");
    process.exit(1);
  }

  const base = path.resolve(PUBLIC_VISUALS_DIR);
  if (!fs.existsSync(base)) {
    console.error("PUBLIC_VISUALS_DIR does not exist:", base);
    process.exit(1);
  }

  const files = [];
  walkFiles(base, base, files);

  console.log(`Found ${files.length} file(s) under ${base}`);
  console.log(`DRY_RUN=${DRY_RUN} LIMIT=${Number.isFinite(LIMIT) ? LIMIT : "∞"}`);
  if (MANIFEST_PATH) console.log("Manifest:", MANIFEST_PATH);

  const manifest = [];

  let done = 0;
  for (const { full, rel } of files) {
    if (done >= LIMIT) break;
    const key = objectKeyFromVisualsRel(rel);
    if (DRY_RUN) {
      console.log(`[dry-run] would upload key=${key}`);
      done += 1;
      continue;
    }

    const buf = fs.readFileSync(full);
    const ct = guessContentType(full);
    const result = await tryPutBuffer(buf, key, ct);
    if (result) {
      console.log(`[ok] ${key} -> ${result.storage} ${result.url.slice(0, 80)}...`);
      manifest.push({
        key,
        url: result.url,
        storage: result.storage,
        rel,
        publicPath: `/visuals/${rel}`.replace(/\\/g, "/"),
      });
    } else {
      console.error(`[fail] ${key} — cloud upload returned null`);
    }
    done += 1;
  }

  if (!DRY_RUN && MANIFEST_PATH && manifest.length) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`Wrote manifest (${manifest.length} entries) to ${MANIFEST_PATH}`);
  }

  if (DRY_RUN) {
    console.log("\nSet DRY_RUN=0 to upload. Keys are prefixed with visuals/ to match HTTP paths /visuals/...");
    console.log(
      "Set REACT_APP_PUBLIC_VISUALS_CDN_URL to your public base (e.g. same as R2_PUBLIC_URL) for the SPA."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
