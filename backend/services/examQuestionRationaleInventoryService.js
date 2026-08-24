/**
 * V2.2 read-only Exam Composite MCQ rationale inventory.
 * Classification, filtering, counting and pagination run in MongoDB.
 * Node receives only small summaries + the current page (max 100 rows).
 * No writes, no LLM, no backfill.
 */
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const {
  RATIONALE_BUCKETS,
  escapeRegex,
  buildMongoMcqClassificationFields,
} = require("../utils/classifyMcqRationaleInventory");

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const STEM_TRUNCATE = 180;
const RATIONALE_TRUNCATE = 280;

const LINKED_LESSON_COUNT = Object.freeze({
  available: false,
  deferred: true,
  reason:
    "linkedLessonCount requires an indexed reverse lookup on lesson pages.blocks.examQuestionId; deferred to avoid an uncontrolled collection scan in V2.2.",
});

const ALLOWED_STATUSES = new Set(["draft", "published", "archived"]);

function asScalarString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
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

function truncateExpr(fieldRef, max) {
  return {
    $cond: [
      { $gt: [{ $strLenCP: { $ifNull: [fieldRef, ""] } }, max] },
      {
        $concat: [{ $substrCP: [{ $ifNull: [fieldRef, ""] }, 0, Math.max(0, max - 1)] }, "…"],
      },
      { $ifNull: [fieldRef, ""] },
    ],
  };
}

function buildMatch(query = {}) {
  const match = {
    $or: [{ type: "composite" }, { questionMode: "composite" }],
  };

  const status = asScalarString(query.status).toLowerCase();
  if (status && ALLOWED_STATUSES.has(status)) {
    if (status === "archived") {
      match.isArchived = true;
    } else {
      match.status = status;
      match.isArchived = { $ne: true };
    }
  } else {
    match.isArchived = { $ne: true };
    match.status = { $in: ["draft", "published"] };
  }

  const subject = asScalarString(query.subject);
  if (subject) match.subject = subject;

  const examBoard = asScalarString(query.examBoard);
  if (examBoard) match.examBoard = examBoard;

  const level = asScalarString(query.level);
  if (level) match.level = level;

  const topicKey = asScalarString(query.topicKey);
  if (topicKey) {
    match.topicKey = topicKey;
  } else {
    const topic = asScalarString(query.topic);
    if (topic) {
      match.topic = { $regex: escapeRegex(topic), $options: "i" };
    }
  }

  const teacherIdRaw = asScalarString(query.teacherId);
  if (teacherIdRaw) {
    if (mongoose.Types.ObjectId.isValid(teacherIdRaw)) {
      match.teacherId = new mongoose.Types.ObjectId(teacherIdRaw);
    } else {
      match.teacherId = new mongoose.Types.ObjectId("000000000000000000000000");
    }
  }

  return match;
}

function parsePage(filters) {
  const page = Math.max(1, parseInt(String(filters.page || "1"), 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(filters.pageSize || String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE)
  );
  return { page, pageSize };
}

function parseRowFilters(filters) {
  const bucketRaw = asScalarString(filters.rationaleBucket).toLowerCase();
  const bucketFilter = RATIONALE_BUCKETS.includes(bucketRaw) ? bucketRaw : null;

  const eligibleRaw = filters.potentiallyEligibleForBackfill;
  let eligibleFilter = null;
  if (eligibleRaw === true || eligibleRaw === "true" || eligibleRaw === "1") {
    eligibleFilter = true;
  } else if (eligibleRaw === false || eligibleRaw === "false" || eligibleRaw === "0") {
    eligibleFilter = false;
  }

  const rowMatch = {};
  if (bucketFilter) rowMatch.rationaleBucket = bucketFilter;
  if (eligibleFilter !== null) rowMatch.potentiallyEligibleForBackfill = eligibleFilter;
  return { bucketFilter, eligibleFilter, rowMatch };
}

/**
 * Production inventory aggregation pipeline.
 * Exported for structure tests — proves DB-layer pagination.
 */
function buildMcqRationaleInventoryPipeline(filters = {}) {
  const { page, pageSize } = parsePage(filters);
  const { rowMatch } = parseRowFilters(filters);
  const match = buildMatch(filters);
  const skip = (page - 1) * pageSize;
  const hasRowMatch = Object.keys(rowMatch).length > 0;

  const classificationStages = buildMongoMcqClassificationFields();
  const rowMatchStages = hasRowMatch ? [{ $match: rowMatch }] : [];

  const summaryBucketGroup = {
    $group: {
      _id: null,
      totalCompositeMcqParts: { $sum: 1 },
      missing: { $sum: { $cond: [{ $eq: ["$rationaleBucket", "missing"] }, 1, 0] } },
      empty: { $sum: { $cond: [{ $eq: ["$rationaleBucket", "empty"] }, 1, 0] } },
      generic: { $sum: { $cond: [{ $eq: ["$rationaleBucket", "generic"] }, 1, 0] } },
      substantive: { $sum: { $cond: [{ $eq: ["$rationaleBucket", "substantive"] }, 1, 0] } },
      malformed: { $sum: { $cond: [{ $eq: ["$rationaleBucket", "malformed"] }, 1, 0] } },
      potentiallyEligible: {
        $sum: { $cond: [{ $eq: ["$potentiallyEligibleForBackfill", true] }, 1, 0] },
      },
      published: { $sum: { $cond: [{ $eq: ["$statusDisplay", "published"] }, 1, 0] } },
      draft: { $sum: { $cond: [{ $eq: ["$statusDisplay", "draft"] }, 1, 0] } },
    },
  };

  const stemSource = {
    $let: {
      vars: {
        s: {
          $cond: [
            {
              $gt: [
                {
                  $strLenCP: {
                    $trim: {
                      input: {
                        $convert: {
                          input: "$sharedStem",
                          to: "string",
                          onError: "",
                          onNull: "",
                        },
                      },
                    },
                  },
                },
                0,
              ],
            },
            {
              $trim: {
                input: {
                  $convert: { input: "$sharedStem", to: "string", onError: "", onNull: "" },
                },
              },
            },
            {
              $trim: {
                input: {
                  $convert: { input: "$question", to: "string", onError: "", onNull: "" },
                },
              },
            },
          ],
        },
      },
      in: "$$s",
    },
  };

  return [
    { $match: match },
    {
      $project: {
        subject: 1,
        examBoard: 1,
        level: 1,
        topic: 1,
        topicKey: 1,
        status: 1,
        isArchived: 1,
        sharedStem: 1,
        question: 1,
        parts: 1,
        teacherId: 1,
        updatedAt: 1,
        type: 1,
        questionMode: 1,
      },
    },
    { $unwind: { path: "$parts", preserveNullAndEmptyArrays: false } },
    {
      $match: {
        $expr: {
          $eq: [
            {
              $toLower: {
                $trim: {
                  input: {
                    $convert: { input: "$parts.type", to: "string", onError: "", onNull: "" },
                  },
                },
              },
            },
            "mcq",
          ],
        },
      },
    },
    ...classificationStages,
    {
      $facet: {
        summaryBuckets: [summaryBucketGroup],
        summaryQuestions: [{ $group: { _id: "$_id" } }, { $count: "totalCompositeQuestions" }],
        totalMatching: [...rowMatchStages, { $count: "count" }],
        items: [
          ...rowMatchStages,
          { $sort: { updatedAt: -1, _id: 1, "parts.label": 1 } },
          { $skip: skip },
          { $limit: pageSize },
          {
            $lookup: {
              from: "users",
              let: { tid: "$teacherId" },
              pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$tid"] } } },
                { $project: { _id: 1, firstName: 1, lastName: 1 } },
              ],
              as: "_ownerDocs",
            },
          },
          {
            $project: {
              _id: 0,
              questionId: { $toString: "$_id" },
              partLabel: "$invPartLabel",
              subject: { $ifNull: ["$subject", null] },
              examBoard: { $ifNull: ["$examBoard", null] },
              level: { $ifNull: ["$level", null] },
              topic: { $ifNull: ["$topic", null] },
              topicKey: { $ifNull: ["$topicKey", null] },
              status: "$statusDisplay",
              sharedStem: truncateExpr(stemSource, STEM_TRUNCATE),
              questionText: "$invQuestionText",
              options: "$invOptions",
              correctOption: "$invCorrectOption",
              correctIndex: "$invCorrectIndex",
              markScheme: "$invMarkScheme",
              currentRationale: {
                $cond: [
                  { $eq: ["$invExplanation", null] },
                  null,
                  truncateExpr("$invExplanation", RATIONALE_TRUNCATE),
                ],
              },
              rationaleBucket: "$rationaleBucket",
              potentiallyEligibleForBackfill: "$potentiallyEligibleForBackfill",
              updatedAt: { $ifNull: ["$updatedAt", null] },
              ownerId: {
                $let: {
                  vars: { o: { $arrayElemAt: ["$_ownerDocs", 0] } },
                  in: {
                    $cond: [
                      { $ne: ["$$o", null] },
                      { $toString: "$$o._id" },
                      {
                        $cond: [
                          { $ne: ["$teacherId", null] },
                          { $toString: "$teacherId" },
                          null,
                        ],
                      },
                    ],
                  },
                },
              },
              ownerName: {
                $let: {
                  vars: { o: { $arrayElemAt: ["$_ownerDocs", 0] } },
                  in: {
                    $let: {
                      vars: {
                        n: {
                          $trim: {
                            input: {
                              $concat: [
                                { $ifNull: ["$$o.firstName", ""] },
                                " ",
                                { $ifNull: ["$$o.lastName", ""] },
                              ],
                            },
                          },
                        },
                      },
                      in: {
                        $cond: [{ $gt: [{ $strLenCP: "$$n" }, 0] }, "$$n", "—"],
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    },
  ];
}

async function getMcqRationaleInventory(filters = {}) {
  const { page, pageSize } = parsePage(filters);
  const pipeline = buildMcqRationaleInventoryPipeline(filters);

  const agg = await ExamQuestion.aggregate(pipeline).allowDiskUse(true);
  const facet = agg[0] || {
    summaryBuckets: [],
    summaryQuestions: [],
    totalMatching: [],
    items: [],
  };

  const bucketRow = facet.summaryBuckets[0] || {};
  const summary = emptySummary();
  summary.totalCompositeMcqParts = bucketRow.totalCompositeMcqParts || 0;
  summary.missing = bucketRow.missing || 0;
  summary.empty = bucketRow.empty || 0;
  summary.generic = bucketRow.generic || 0;
  summary.substantive = bucketRow.substantive || 0;
  summary.malformed = bucketRow.malformed || 0;
  summary.potentiallyEligible = bucketRow.potentiallyEligible || 0;
  summary.published = bucketRow.published || 0;
  summary.draft = bucketRow.draft || 0;
  summary.totalCompositeQuestions =
    (facet.summaryQuestions[0] && facet.summaryQuestions[0].totalCompositeQuestions) || 0;

  const totalMatchingParts =
    (facet.totalMatching[0] && facet.totalMatching[0].count) || 0;
  const totalPages = Math.max(1, Math.ceil(totalMatchingParts / pageSize) || 1);
  const safePage = Math.min(page, totalPages);

  let items = facet.items || [];
  if (safePage !== page && totalMatchingParts > 0) {
    const retry = await ExamQuestion.aggregate(
      buildMcqRationaleInventoryPipeline({ ...filters, page: safePage, pageSize })
    ).allowDiskUse(true);
    items = (retry[0] && retry[0].items) || [];
  }

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
  buildMcqRationaleInventoryPipeline,
  parsePage,
  parseRowFilters,
  asScalarString,
  escapeRegex,
};
