/**
 * Block 28 Phase 2 — future write interfaces (data structures only; no execution).
 * Write commands are NOT implemented in Phase 2 tooling v1.
 */

/**
 * @typedef {object} Phase2RepairSnapshot
 * @property {string} repairJobId
 * @property {string} dbName
 * @property {string} createdAt
 * @property {string} track
 * @property {string} approvedBy
 * @property {string} approvedManifestHash
 * @property {Array<object>} records
 */

/**
 * @typedef {object} Phase2WriteGuard
 * @property {string} questionId
 * @property {string} expectedUpdatedAt
 * @property {number} expectedMarks
 * @property {string} expectedQuestion
 * @property {string} expectedMarkSchemeFingerprint
 * @property {string} expectedMasterFingerprint
 * @property {string} type
 */

/**
 * Build a snapshot record shape for a future approved batch (no DB write).
 */
function buildSnapshotRecordShape({ master, proposedMarkScheme, repairJobId, track = "P1" }) {
  return {
    repairJobId,
    track,
    questionId: master.questionId,
    updatedAt: master.updatedAt,
    fingerprint: master.fingerprint,
    fields: {
      question: master.question,
      marks: master.marks,
      markScheme: master.markSchemeNormalized,
      metadata: master.metadataSource ? { source: master.metadataSource } : null,
    },
    lessonRefs: (master.publishedLessonRefs || []).map((ref) => ({
      lessonId: ref.lessonId,
      position: ref.position,
      lessonEditFingerprint: ref.lessonEditFingerprint,
    })),
    proposedMarkScheme,
    repairClassification: master.repairClassification,
  };
}

/**
 * Build write guard expectations for a future atomic master update (no DB write).
 */
function buildWriteGuardShape({ master, snapshotRecord }) {
  return {
    questionId: master.questionId,
    expectedUpdatedAt: snapshotRecord.updatedAt,
    expectedMarks: snapshotRecord.fields.marks,
    expectedQuestion: snapshotRecord.fields.question,
    expectedMarkSchemeFingerprint: JSON.stringify(snapshotRecord.fields.markScheme),
    expectedMasterFingerprint: snapshotRecord.fingerprint,
    type: "short",
    allowedFields: ["markScheme", "metadata.block28Repair"],
  };
}

/** Explicit guard: no Mongo write methods in this module. */
const WRITE_METHODS_FORBIDDEN = [
  "updateOne",
  "updateMany",
  "bulkWrite",
  "save",
  "insert",
  "delete",
  "findOneAndUpdate",
];

module.exports = {
  buildSnapshotRecordShape,
  buildWriteGuardShape,
  WRITE_METHODS_FORBIDDEN,
};
