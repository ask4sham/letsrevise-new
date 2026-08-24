/**
 * Non-destructive ensure/verify for the V2.3B2b2a Attempt-2 partial unique index.
 * Prefer createIndex — never syncIndexes (can drop unrelated indexes).
 *
 * Index contract (must match ExamQuestionRationaleCandidate schema):
 *   name: uq_attempt2_generation_group
 *   keys: { generationGroupKey: 1 }
 *   unique: true
 *   partialFilterExpression: { attemptNumber: 2 }
 */
const ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");

const ATTEMPT_TWO_GENERATION_GROUP_INDEX = {
  keys: { generationGroupKey: 1 },
  options: {
    unique: true,
    name: "uq_attempt2_generation_group",
    partialFilterExpression: { attemptNumber: 2 },
  },
};

function indexKeysMatch(a, b) {
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

function isMatchingAttemptTwoIndex(idx) {
  if (!idx) return false;
  if (idx.name !== ATTEMPT_TWO_GENERATION_GROUP_INDEX.options.name) return false;
  if (idx.unique !== true) return false;
  if (!indexKeysMatch(idx.key || {}, ATTEMPT_TWO_GENERATION_GROUP_INDEX.keys)) return false;
  return partialFilterMatch(
    idx.partialFilterExpression,
    ATTEMPT_TWO_GENERATION_GROUP_INDEX.options.partialFilterExpression
  );
}

function findIndexByKeyPattern(indexes, keys) {
  return (indexes || []).find((idx) => indexKeysMatch(idx.key || {}, keys));
}

async function ensureCollectionExists(Model) {
  try {
    await Model.createCollection();
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (!/already exists|NamespaceExists|exists/i.test(msg) && e.code !== 48) {
      // createIndex may still succeed
    }
  }
}

/**
 * Verify the exact Attempt-2 partial unique index exists.
 * @returns {{ ok: boolean, reason?: string, message?: string, indexName?: string, indexesChecked?: number }}
 */
async function verifyAttemptTwoGenerationGroupIndex(Model = ExamQuestionRationaleCandidate) {
  await ensureCollectionExists(Model);
  let indexes;
  try {
    const cursor = Model.collection.listIndexes();
    indexes = await cursor.toArray();
  } catch (e) {
    return {
      ok: false,
      reason: "list_indexes_failed",
      message:
        "Could not list ExamQuestionRationaleCandidate indexes required for Attempt-2 uniqueness. " +
        "Startup cannot continue without verifying uq_attempt2_generation_group.",
    };
  }

  const byName = (indexes || []).find(
    (idx) => idx.name === ATTEMPT_TWO_GENERATION_GROUP_INDEX.options.name
  );
  if (byName && !isMatchingAttemptTwoIndex(byName)) {
    return {
      ok: false,
      reason: "incompatible_index_same_name",
      indexName: byName.name,
      unique: !!byName.unique,
      hasPartialFilter: !!byName.partialFilterExpression,
      message:
        `Index "${ATTEMPT_TWO_GENERATION_GROUP_INDEX.options.name}" exists but does not match the required ` +
        "Attempt-2 contract (unique generationGroupKey where attemptNumber:2). Manual resolution required.",
    };
  }

  const exact = (indexes || []).find(isMatchingAttemptTwoIndex);
  if (exact) {
    return { ok: true, indexName: exact.name, indexesChecked: indexes.length };
  }

  const byPattern = findIndexByKeyPattern(indexes, ATTEMPT_TWO_GENERATION_GROUP_INDEX.keys);
  if (byPattern) {
    return {
      ok: false,
      reason: "incompatible_index_same_key_pattern",
      indexName: byPattern.name,
      unique: !!byPattern.unique,
      hasPartialFilter: !!byPattern.partialFilterExpression,
      message:
        `ExamQuestionRationaleCandidate has index "${byPattern.name}" on { generationGroupKey: 1 } ` +
        "but unique/partialFilterExpression/name do not match uq_attempt2_generation_group. Manual resolution required.",
    };
  }

  return {
    ok: false,
    reason: "missing_index",
    message:
      "ExamQuestionRationaleCandidate is missing unique partial index " +
      "uq_attempt2_generation_group on { generationGroupKey: 1 } with partialFilterExpression { attemptNumber: 2 }.",
  };
}

/**
 * Non-destructive ensure: createIndex when missing, then verify.
 * Never drops or syncs unrelated indexes.
 */
async function ensureAttemptTwoGenerationGroupIndex(Model = ExamQuestionRationaleCandidate) {
  await ensureCollectionExists(Model);

  const before = await verifyAttemptTwoGenerationGroupIndex(Model);
  if (before.ok) {
    return { created: false, verified: true, indexName: before.indexName };
  }

  if (
    before.reason === "incompatible_index_same_name" ||
    before.reason === "incompatible_index_same_key_pattern"
  ) {
    const err = new Error(before.message || "Attempt-2 index conflict");
    err.code = "ATTEMPT_TWO_INDEX_CONFLICT";
    err.details = before;
    throw err;
  }

  if (before.reason === "list_indexes_failed") {
    const err = new Error(before.message || "Attempt-2 index list failed");
    err.code = "ATTEMPT_TWO_INDEX_LIST_FAILED";
    err.details = before;
    throw err;
  }

  try {
    await Model.collection.createIndex(ATTEMPT_TWO_GENERATION_GROUP_INDEX.keys, {
      ...ATTEMPT_TWO_GENERATION_GROUP_INDEX.options,
    });
  } catch (e) {
    const err = new Error(
      `Failed to create Attempt-2 index uq_attempt2_generation_group: ${e && e.message ? e.message : e}`
    );
    err.code = "ATTEMPT_TWO_INDEX_CREATE_FAILED";
    err.cause = e;
    throw err;
  }

  const after = await verifyAttemptTwoGenerationGroupIndex(Model);
  if (!after.ok) {
    const err = new Error(
      `Attempt-2 index createIndex completed but verification failed: ${after.message || after.reason}`
    );
    err.code = "ATTEMPT_TWO_INDEX_VERIFY_FAILED";
    err.details = after;
    throw err;
  }

  return { created: true, verified: true, indexName: after.indexName };
}

/**
 * Awaited bootstrap hook: ensure + verify Attempt-2 index after Mongo connect, before HTTP listen.
 * Throws on any failure (fail closed).
 */
async function ensureExamQuestionRationaleCandidateIndexes(
  Model = ExamQuestionRationaleCandidate
) {
  return ensureAttemptTwoGenerationGroupIndex(Model);
}

/**
 * True when a Mongo duplicate-key error is attributable to the Attempt-2 unique index.
 */
function isMongoAttemptTwoIndexCollision(err) {
  if (!err || Number(err.code) !== 11000) return false;

  const indexName =
    err.indexName ||
    err.index ||
    (err.cause && (err.cause.indexName || err.cause.index)) ||
    "";
  if (String(indexName) === ATTEMPT_TWO_GENERATION_GROUP_INDEX.options.name) return true;

  const keyPattern = err.keyPattern || (err.cause && err.cause.keyPattern) || null;
  if (
    keyPattern &&
    indexKeysMatch(keyPattern, ATTEMPT_TWO_GENERATION_GROUP_INDEX.keys) &&
    Object.keys(keyPattern).length === 1
  ) {
    return true;
  }

  const msg = String(err.message || err.errmsg || "");
  if (msg.includes(ATTEMPT_TWO_GENERATION_GROUP_INDEX.options.name)) return true;

  return false;
}

module.exports = {
  ATTEMPT_TWO_GENERATION_GROUP_INDEX,
  indexKeysMatch,
  isMatchingAttemptTwoIndex,
  verifyAttemptTwoGenerationGroupIndex,
  ensureAttemptTwoGenerationGroupIndex,
  ensureExamQuestionRationaleCandidateIndexes,
  isMongoAttemptTwoIndexCollision,
};
