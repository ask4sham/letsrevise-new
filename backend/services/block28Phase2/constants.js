/**
 * Block 28 Phase 2 legacy repair — read-only tooling constants.
 */

const REPAIR_CLASS = Object.freeze({
  REGENERATE_MARK_SCHEME: "REGENERATE_MARK_SCHEME",
  REVIEW_MARK_VALUE: "REVIEW_MARK_VALUE",
  REVIEW_QUESTION_AND_SCHEME: "REVIEW_QUESTION_AND_SCHEME",
  NO_SAFE_PROPOSAL: "NO_SAFE_PROPOSAL",
});

const APPROVAL_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_EDIT: "needs_edit",
  DEFERRED: "deferred",
});

/** Authoritative reconciled production P1 census (Phase 2 read-only baseline). */
const EXPECTED_P1_CENSUS = Object.freeze({
  effectiveMismatchedAttachments: 590,
  publishedLessons: 87,
  uniqueMasters: 552,
  draftAttachments: 0,
});

const MUTATION_LESSON_ID = "6a9198c765e15e080aee9ad9";

const COMMAND_WORDS_ANALYTICAL = ["explain", "describe", "compare", "evaluate", "discuss", "analyse", "analyze"];
const COMMAND_WORDS_RECALL = ["state", "name", "give", "identify", "define", "list"];

module.exports = {
  REPAIR_CLASS,
  APPROVAL_STATUS,
  EXPECTED_P1_CENSUS,
  MUTATION_LESSON_ID,
  COMMAND_WORDS_ANALYTICAL,
  COMMAND_WORDS_RECALL,
};
