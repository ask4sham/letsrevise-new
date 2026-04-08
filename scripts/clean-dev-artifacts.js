#!/usr/bin/env node
/**
 * Safe cleanup of regenerable dev artifacts (does not touch source, uploads, or node_modules
 * except the webpack cache folder).
 *
 * Usage: node scripts/clean-dev-artifacts.js
 *    or: npm run clean:artifacts
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const TARGETS = [
  path.join(ROOT, "frontend", "node_modules", ".cache"),
  path.join(ROOT, "backend", "coverage"),
  path.join(ROOT, "frontend", "build"),
];

const SKIP_DIR_NAMES = new Set([
  ".git",
  "node_modules", // entire tree skipped when walking for .crdownload
]);

function rmDirIfExists(p) {
  if (!fs.existsSync(p)) {
    console.log(`[skip] not found: ${path.relative(ROOT, p)}`);
    return;
  }
  fs.rmSync(p, { recursive: true, force: true });
  console.log(`[removed] ${path.relative(ROOT, p)}`);
}

function walkCrdownload(dir) {
  let n = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return n;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR_NAMES.has(e.name)) continue;
      n += walkCrdownload(full);
    } else if (e.isFile() && e.name.endsWith(".crdownload")) {
      try {
        fs.unlinkSync(full);
        console.log(`[removed] ${path.relative(ROOT, full)}`);
        n += 1;
      } catch (err) {
        console.warn(`[warn] could not remove ${full}:`, err.message);
      }
    }
  }
  return n;
}

function main() {
  console.log("Cleaning dev artifacts under:", ROOT);
  for (const t of TARGETS) {
    rmDirIfExists(t);
  }
  const n = walkCrdownload(ROOT);
  console.log(`Done. Removed ${n} .crdownload file(s).`);
}

main();
