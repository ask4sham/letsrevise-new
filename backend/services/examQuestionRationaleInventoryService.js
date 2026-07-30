/**
 * V2.2 read-only Exam Composite MCQ rationale inventory.
 * No writes, no LLM, no backfill.
 */
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const {
  RATIONALE_BUCKETS,
  classifyCompositeMcqPart,
} = require("../utils/classifyMcqRationaleInventory");

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const STEM_TRUNCATE = 180;
const RATIONALE_TRUNCATE = 280;

/** Linked lesson counts deferred: pages.blocks.examQuestionId is not indexed for reverse lookup. */
const LINKED_LESSON_COUNT = Object.freeze({
  available: false,
  deferred: true,
  reason:
    "linkedLessonCount requires an indexed reverse lookup on lesson pages.blocks.examQuestionId; deferred to avoid an uncontrolled collection scan in V2.2.",
});

function truncate(text, max) {
  const s = String(text || "");
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function emptySummary() {
  return {
    countUnit: "mcq_parts",
    totalCompositeQuestions: 0,
    totalCompositeMcqParts: 0,
    missing: 0,
    empty: 0,
    generic: 0,
    substantive: 0,
    malformed: 0,
    potentiallyEligible: 0,
    published: 0,
    draft: 0,
  };
}

/**
 * @param {Record<string, unknown>} query
 */
function buildMatch(query = {}) {
  const match = {
    $or: [{ type: "composite" }, { questionMode: "composite" }],
  };

  const status = String(query.status || "")
    .trim()
    .toLowerCase();
  if (status === "archived") {
    match.isArchived = true;
  } else if (status === "draft" || status === "published") {
    match.status = status;
    match.isArchived = { $ne: true };
  } else {
    // Default inventory: active draft + published (exclude archived unless requested).
    match.isArchived = { $ne: true };
    match.status = { $in: ["draft", "published"] };
  }

  if (query.subject && String(query.subject).trim()) {
    match.subject = String(query.subject).trim();
  }
  if (query.examBoard && String(query.examBoard).trim()) {
    match.examBoard = String(query.examBoard).trim();
  }
  if (query.level && String(query.level).trim()) {
    match.level = String(query.level).trim();
  }
  if (query.topicKey && String(query.topicKey).trim()) {
    match.topicKey = { $regex: String(query.topicKey).trim(), $options: "i" };
  } else if (query.topic && String(query.topic).trim()) {
    match.topic = { $regex: String(query.topic).trim(), $options: "i" };
  }
  if (query.teacherId && mongoose.Types.ObjectId.isValid(String(query.teacherId))) {
    match.teacherId = new mongoose.Types.ObjectId(String(query.teacherId));
  }

  return match;
}

/**
 * @param {object} doc lean ExamQuestion
 * @returns {object[]}
 */
function flattenMcqParts(doc) {
  const parts = Array.isArray(doc.parts) ? doc.parts : [];
  const rows = [];
  const questionIdsSeen = true;
  void questionIdsSeen;

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    if (String(part.type || "").trim().toLowerCase() !== "mcq") continue;

    const classified = classifyCompositeMcqPart(part, {
      isArchived: Boolean(doc.isArchived),
      subject: doc.subject,
      topic: doc.topic,
      topicKey: doc.topicKey,
    });

    const owner = doc.teacherId;
    const ownerId =
      owner && typeof owner === "object" && owner._id != null ? String(owner._id) : owner != null ? String(owner) : null;
    const ownerName =
      owner && typeof owner === "object"
        ? [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() || owner.email || "—"
        : "—";

    rows.push({
      questionId: String(doc._id),
      partLabel: classified.label || String(part.label || "").trim() || "?",
      subject: doc.subject || null,
      examBoard: doc.examBoard || null,
      level: doc.level || null,
      topic: doc.topic || null,
      topicKey: doc.topicKey || null,
      status: doc.isArchived ? "archived" : doc.status || null,
      sharedStem: truncate(doc.sharedStem || doc.question || "", STEM_TRUNCATE),
      questionText: classified.questionText,
      options: classified.options,
      correctOption: classified.correctOption,
      correctIndex: classified.correctIndex,
      markScheme: Array.isArray(part.markScheme)
        ? part.markScheme.map((l) => String(l || "").trim()).filter(Boolean)
        : [],
      currentRationale: classified.explanation != null ? truncate(classified.explanation, RATIONALE_TRUNCATE) : null,
      rationaleBucket: classified.bucket,
      potentiallyEligibleForBackfill: classified.potentiallyEligibleForBackfill,
      updatedAt: doc.updatedAt || null,
      ownerId,
      ownerName,
      structureReason: classified.structureReason || null,
    });
  }
  return rows;
}

/**
 * @param {{
 *   subject?: string,
 *   examBoard?: string,
 *   level?: string,
 *   topic?: string,
 *   topicKey?: string,
 *   status?: string,
 *   teacherId?: string,
 *   rationaleBucket?: string,
 *   potentiallyEligibleForBackfill?: boolean | string,
 *   page?: number | string,
 *   pageSize?: number | string,
 * }} filters
 */
async function getMcqRationaleInventory(filters = {}) {
  const page = Math.max(1, parseInt(String(filters.page || "1"), 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(filters.pageSize || String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE)
  );

  const bucketFilter = String(filters.rationaleBucket || "")
    .trim()
    .toLowerCase();
  const eligibleRaw = filters.potentiallyEligibleForBackfill;
  const eligibleFilter =
    eligibleRaw === true ||
    eligibleRaw === "true" ||
    eligibleRaw === "1" ||
    eligibleRaw === false ||
    eligibleRaw === "false" ||
    eligibleRaw === "0"
      ? eligibleRaw === true || eligibleRaw === "true" || eligibleRaw === "1"
      : null;

  const match = buildMatch(filters);

  // Project only inventory fields — never full documents / secrets / unrelated metadata.
  const docs = await ExamQuestion.find(match)
    .select({
      subject: 1,
      examBoard: 1,
      level: 1,
      topic: 1,
      topicKey: 1,
      status: 1,
      isArchived: 1,
      sharedStem: 1,
      question: 1,
      title: 1,
      parts: 1,
      teacherId: 1,
      updatedAt: 1,
      type: 1,
      questionMode: 1,
    })
    .populate("teacherId", "firstName lastName email")
    .sort({ updatedAt: -1 })
    .lean();

  const compositeQuestionIds = new Set(docs.map((d) => String(d._id)));
  /** @type {ReturnType<typeof flattenMcqParts>} */
  let allRows = [];
  for (const doc of docs) {
    allRows = allRows.concat(flattenMcqParts(doc));
  }

  const summary = emptySummary();
  summary.totalCompositeQuestions = compositeQuestionIds.size;
  summary.totalCompositeMcqParts = allRows.length;

  for (const row of allRows) {
    if (RATIONALE_BUCKETS.includes(row.rationaleBucket)) {
      summary[row.rationaleBucket] += 1;
    }
    if (row.potentiallyEligibleForBackfill) summary.potentiallyEligible += 1;
    if (row.status === "published") summary.published += 1;
    if (row.status === "draft") summary.draft += 1;
  }

  let filtered = allRows;
  if (bucketFilter && RATIONALE_BUCKETS.includes(bucketFilter)) {
    filtered = filtered.filter((r) => r.rationaleBucket === bucketFilter);
  }
  if (eligibleFilter !== null) {
    filtered = filtered.filter((r) => r.potentiallyEligibleForBackfill === eligibleFilter);
  }

  const totalMatchingParts = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalMatchingParts / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map((row) => {
    // Strip internal structureReason from client payload unless malformed (useful for admins).
    const { structureReason, ...rest } = row;
    if (row.rationaleBucket === "malformed" && structureReason) {
      return { ...rest, structureReason };
    }
    return rest;
  });

  return {
    page: safePage,
    pageSize,
    totalMatchingParts,
    totalPages,
    summary,
    items,
    linkedLessonCount: LINKED_LESSON_COUNT,
    readOnly: true,
  };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  LINKED_LESSON_COUNT,
  getMcqRationaleInventory,
  buildMatch,
  flattenMcqParts,
};
