/**
 * Non-destructive PracticeSet idempotency index helpers.
 * Prefer createIndex / createIndexes — never syncIndexes (can drop unrelated indexes).
 */
const PracticeSet = require("../models/PracticeSet");

/** Exact intended index (must match PracticeSet schema declaration). */
const PRACTICE_SET_IDEMPOTENCY_INDEX = {
  keys: { studentId: 1, idempotencyKey: 1 },
  options: {
    unique: true,
    name: "studentId_1_idempotencyKey_1_partial_string",
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
};

function indexKeysMatch(a, b) {
  const keysA = Object.keys(a || {});
  const keysB = Object.keys(b || {});
  if (keysA.length !== keysB.length) return false;
  // Preserve declared order: studentId then idempotencyKey
  const orderedA = Object.entries(a || {});
  const orderedB = Object.entries(b || {});
  if (orderedA.length !== orderedB.length) return false;
  for (let i = 0; i < orderedA.length; i++) {
    if (orderedA[i][0] !== orderedB[i][0] || orderedA[i][1] !== orderedB[i][1]) return false;
  }
  return true;
}

function partialFilterMatch(actual, expected) {
  if (!actual || !expected) return false;
  try {
    return JSON.stringify(actual) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

/**
 * Find existing index with the same key pattern (any options).
 */
function findIndexByKeyPattern(indexes, keys) {
  return (indexes || []).find((idx) => indexKeysMatch(idx.key || {}, keys));
}

/**
 * True when an index matches the full intended unique + partial definition.
 */
function isMatchingIdempotencyIndex(idx) {
  if (!idx) return false;
  if (idx.unique !== true) return false;
  if (!indexKeysMatch(idx.key || {}, PRACTICE_SET_IDEMPOTENCY_INDEX.keys)) return false;
  return partialFilterMatch(
    idx.partialFilterExpression,
    PRACTICE_SET_IDEMPOTENCY_INDEX.options.partialFilterExpression
  );
}

/**
 * Preflight: count duplicate non-empty string idempotency keys per student.
 * Does not modify data. Does not return student ids or key values.
 */
async function preflightIdempotencyKeyDuplicates(Model = PracticeSet) {
  await ensureCollectionExists(Model);
  const coll = Model.collection;
  const rows = await coll
    .aggregate([
      {
        $match: {
          idempotencyKey: { $type: "string", $ne: "" },
        },
      },
      {
        $group: {
          _id: { studentId: "$studentId", idempotencyKey: "$idempotencyKey" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      {
        $group: {
          _id: null,
          duplicateGroupCount: { $sum: 1 },
          duplicateDocumentTotal: { $sum: "$count" },
        },
      },
    ])
    .toArray();

  const summary = rows[0] || { duplicateGroupCount: 0, duplicateDocumentTotal: 0 };
  return {
    ok: summary.duplicateGroupCount === 0,
    duplicateGroupCount: summary.duplicateGroupCount || 0,
    duplicateDocumentTotal: summary.duplicateDocumentTotal || 0,
  };
}

async function ensureCollectionExists(Model) {
  try {
    await Model.createCollection();
  } catch (e) {
    // NamespaceExists / already created — fine
    const msg = String(e && e.message ? e.message : e);
    if (!/already exists|NamespaceExists|exists/i.test(msg) && e.code !== 48) {
      // continue; createIndex may still work after first insert
    }
  }
}

/**
 * Verify PracticeSet has the exact partial unique idempotency index.
 */
async function verifyPracticeSetIdempotencyIndex(Model = PracticeSet) {
  await ensureCollectionExists(Model);
  let indexes;
  try {
    indexes = await Model.collection.listIndexes().toArray();
  } catch (e) {
    return {
      ok: false,
      reason: "missing_index",
      message:
        "PracticeSet collection has no indexes yet (collection may be empty/new). " +
        "Run ensure migration to create the partial unique idempotency index.",
    };
  }
  const byPattern = findIndexByKeyPattern(indexes, PRACTICE_SET_IDEMPOTENCY_INDEX.keys);
  const exact = indexes.find(isMatchingIdempotencyIndex);

  if (exact) {
    return { ok: true, indexName: exact.name, indexesChecked: indexes.length };
  }

  if (byPattern) {
    return {
      ok: false,
      reason: "incompatible_index_same_key_pattern",
      indexName: byPattern.name,
      unique: !!byPattern.unique,
      hasPartialFilter: !!byPattern.partialFilterExpression,
      message:
        "PracticeSet has an index on { studentId, idempotencyKey } but unique/partialFilterExpression do not match the required definition.",
    };
  }

  return {
    ok: false,
    reason: "missing_index",
    message:
      "PracticeSet is missing unique partial index on { studentId: 1, idempotencyKey: 1 } with partialFilterExpression { idempotencyKey: { $type: 'string' } }.",
  };
}

/**
 * Non-destructive ensure: preflight duplicates, then createIndex (idempotent when identical).
 * Does not drop other indexes.
 */
async function ensurePracticeSetIdempotencyIndex(Model = PracticeSet, { skipPreflight = false } = {}) {
  await ensureCollectionExists(Model);

  if (!skipPreflight) {
    const preflight = await preflightIdempotencyKeyDuplicates(Model);
    if (!preflight.ok) {
      const err = new Error(
        `PracticeSet idempotency index preflight failed: ${preflight.duplicateGroupCount} duplicate student/key group(s), ${preflight.duplicateDocumentTotal} document(s) involved. Resolve duplicates before creating the unique index.`
      );
      err.code = "PRACTICE_SET_IDEMPOTENCY_DUPLICATES";
      err.preflight = preflight;
      throw err;
    }
  }

  const before = await verifyPracticeSetIdempotencyIndex(Model);
  if (before.ok) {
    return { created: false, verified: true, indexName: before.indexName, preflightSkipped: !!skipPreflight };
  }

  if (before.reason === "incompatible_index_same_key_pattern") {
    const err = new Error(
      `Cannot create PracticeSet idempotency index: incompatible index "${before.indexName}" already exists on the same key pattern. Manual resolution required.`
    );
    err.code = "PRACTICE_SET_IDEMPOTENCY_INDEX_CONFLICT";
    err.details = before;
    throw err;
  }

  await Model.collection.createIndex(PRACTICE_SET_IDEMPOTENCY_INDEX.keys, {
    ...PRACTICE_SET_IDEMPOTENCY_INDEX.options,
  });

  const after = await verifyPracticeSetIdempotencyIndex(Model);
  if (!after.ok) {
    const err = new Error(
      `PracticeSet idempotency index createIndex completed but verification failed: ${after.message || after.reason}`
    );
    err.code = "PRACTICE_SET_IDEMPOTENCY_VERIFY_FAILED";
    err.details = after;
    throw err;
  }

  return { created: true, verified: true, indexName: after.indexName, preflightSkipped: !!skipPreflight };
}

module.exports = {
  PRACTICE_SET_IDEMPOTENCY_INDEX,
  indexKeysMatch,
  isMatchingIdempotencyIndex,
  preflightIdempotencyKeyDuplicates,
  verifyPracticeSetIdempotencyIndex,
  ensurePracticeSetIdempotencyIndex,
};
