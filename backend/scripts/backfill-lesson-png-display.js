/**
 * Backfill normalised PNG display siblings (*.display.png) for existing uploads on local disk.
 * Does not modify MongoDB — originals stay referenced; new files sit beside them for optional future URL swaps.
 *
 * Dry run:  node scripts/backfill-lesson-png-display.js
 * Apply:    node scripts/backfill-lesson-png-display.js --apply
 * Limit:    node scripts/backfill-lesson-png-display.js --apply --limit=100
 *
 * Env: FILE_STORAGE_PATH (see backend/config/paths.js); defaults to backend/uploads.
 * Note: Cloud-only blobs (Supabase/R2 without local copies) are not processed here.
 */
if (!process.env.FILE_STORAGE_PATH) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}

const fs = require("fs");
const path = require("path");
const { FILE_STORAGE_PATH } = require("../config/paths");
const { displayFilenameForPng, createLessonPngDisplayBuffer } = require("../services/lessonPngDisplay");

function walkDir(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else out.push(full);
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

  const base = FILE_STORAGE_PATH;
  const allFiles = walkDir(base);
  const pngs = allFiles.filter((f) => {
    const lower = f.toLowerCase();
    return lower.endsWith(".png") && !lower.endsWith(".display.png");
  });

  let created = 0;
  let skippedHasDisplay = 0;
  let errors = 0;
  let dryRun = 0;

  for (const filePath of pngs) {
    if (created + dryRun >= limit) break;

    const basename = path.basename(filePath);
    const displayName = displayFilenameForPng(basename);
    if (!displayName) continue;

    const displayPath = path.join(path.dirname(filePath), displayName);
    if (fs.existsSync(displayPath)) {
      skippedHasDisplay++;
      continue;
    }

    if (!apply) {
      console.log("[dry-run] would create:", displayPath);
      dryRun++;
      continue;
    }

    try {
      const buf = fs.readFileSync(filePath);
      const outBuf = await createLessonPngDisplayBuffer(buf);
      if (!outBuf) {
        console.warn("[skip] normalisation returned empty:", filePath);
        errors++;
        continue;
      }
      fs.writeFileSync(displayPath, outBuf);
      console.log("[ok]", displayPath);
      created++;
    } catch (e) {
      console.error("[err]", filePath, e.message);
      errors++;
    }
  }

  console.log(
    JSON.stringify(
      {
        apply,
        storageRoot: base,
        totalSourcePngs: pngs.length,
        created,
        dryRunListed: dryRun,
        skippedAlreadyHadDisplay: skippedHasDisplay,
        errors,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
