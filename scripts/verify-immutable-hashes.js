#!/usr/bin/env node
/**
 * verify-immutable-hashes.js
 * Reads docs/curriculum/statutory/immutable-hashes.json and verifies each locked file
 * has the same SHA256 hash. Exits 1 if any file is missing or hash differs.
 * Use --update to write current hashes back to the lock file (one-time setup).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.dirname(__dirname);
const LOCK_PATH = path.join(ROOT, "docs", "curriculum", "statutory", "immutable-hashes.json");

function sha256(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  const buf = fs.readFileSync(abs);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function main() {
  const isUpdate = process.argv.includes("--update");
  const lockRaw = fs.readFileSync(LOCK_PATH, "utf8");
  const lock = JSON.parse(lockRaw);
  const algorithm = lock.algorithm || "sha256";
  const locked = lock.locked || {};
  const entries = Object.entries(locked);

  if (entries.length === 0) {
    console.error("No entries in locked.");
    process.exit(1);
  }

  let failed = false;
  for (const [relPath, expectedHash] of entries) {
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      console.error(`Missing file: ${relPath}`);
      failed = true;
      continue;
    }
    const actualHash = sha256(relPath);
    if (actualHash !== expectedHash) {
      console.error(
        `Hash mismatch: ${relPath}\n  expected: ${expectedHash}\n  actual:   ${actualHash}`
      );
      failed = true;
    }
  }

  if (isUpdate) {
    const newLocked = {};
    for (const [relPath] of entries) {
      const absPath = path.join(ROOT, relPath);
      if (fs.existsSync(absPath)) {
        newLocked[relPath] = sha256(relPath);
      }
    }
    const out = {
      algorithm: lock.algorithm || "sha256",
      locked: newLocked
    };
    fs.writeFileSync(LOCK_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.log("Updated immutable-hashes.json with current hashes.");
    process.exit(0);
  }

  if (failed) {
    process.exit(1);
  }
  console.log("All locked files match their hashes.");
}

main();
