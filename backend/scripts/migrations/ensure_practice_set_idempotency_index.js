/**
 * Non-destructive migration: ensure PracticeSet partial unique idempotency index.
 *
 * Safe: uses collection.createIndex (does not drop unrelated indexes).
 * Preflight: fails if duplicate non-empty studentId+idempotencyKey groups exist.
 *
 * DO NOT run against staging/production from an agent session without operator approval.
 *
 * Local / operator later:
 *   node backend/scripts/migrations/ensure_practice_set_idempotency_index.js
 *   node backend/scripts/migrations/ensure_practice_set_idempotency_index.js --dry-run
 */
require("dotenv").config();
const mongoose = require("mongoose");
const PracticeSet = require("../../models/PracticeSet");
const {
  PRACTICE_SET_IDEMPOTENCY_INDEX,
  preflightIdempotencyKeyDuplicates,
  verifyPracticeSetIdempotencyIndex,
  ensurePracticeSetIdempotencyIndex,
} = require("../../services/practiceSetIdempotencyIndex");

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "";
const dryRun = process.argv.includes("--dry-run");

async function run() {
  if (!uri) {
    console.error("Set MONGODB_URI or MONGO_URI before running this migration.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("[PracticeSet idempotency index] connected");
  console.log("[PracticeSet idempotency index] intended definition:", JSON.stringify(PRACTICE_SET_IDEMPOTENCY_INDEX));

  const preflight = await preflightIdempotencyKeyDuplicates(PracticeSet);
  console.log("[PracticeSet idempotency index] preflight:", JSON.stringify(preflight));
  if (!preflight.ok) {
    console.error(
      "[PracticeSet idempotency index] BLOCKED: duplicate non-empty keys exist. No index created. No data modified."
    );
    await mongoose.disconnect();
    process.exit(2);
  }

  const current = await verifyPracticeSetIdempotencyIndex(PracticeSet);
  if (current.ok) {
    console.log("[PracticeSet idempotency index] already present:", current.indexName);
    await mongoose.disconnect();
    process.exit(0);
  }

  if (dryRun) {
    console.log("[PracticeSet idempotency index] dry-run: would create index. Verification currently:", current);
    await mongoose.disconnect();
    process.exit(0);
  }

  const result = await ensurePracticeSetIdempotencyIndex(PracticeSet, { skipPreflight: true });
  console.log("[PracticeSet idempotency index] ensure result:", result);
  await mongoose.disconnect();
  console.log("[PracticeSet idempotency index] done");
}

run().catch(async (e) => {
  console.error("[PracticeSet idempotency index] FAILED:", e.message);
  if (e.code) console.error("[PracticeSet idempotency index] code:", e.code);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
