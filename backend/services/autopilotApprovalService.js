/**
 * Autopilot Approval Queue — admin review workflow for autopilot-generated draft content.
 * Review + approval only; no generation changes. Compatible with existing draft moderation.
 */
const mongoose = require("mongoose");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");

const ITEM_TYPES = ["flashcard", "quizQuestion", "examQuestion"];
const AUTOPILOT_META = "metadata.generatedBy";
const AUTOPILOT_VALUE = "autopilot";

/**
 * Derive specKey from topicKey (e.g. aqa-gcse-biology:cell-structure -> aqa-gcse-biology).
 */
function deriveSpecKey(topicKey, doc) {
  if (topicKey && topicKey.includes(":")) {
    return topicKey.split(":")[0];
  }
  if (doc?.specKey) return doc.specKey;
  if (doc?.examBoard && doc?.subject && doc?.level) {
    return [doc.examBoard, doc.level, doc.subject].map((s) => (s || "").toLowerCase().replace(/\s/g, "-")).join("-");
  }
  return null;
}

/**
 * Topic display from topicKey.
 */
function topicDisplayName(topicKey) {
  const last = (topicKey || "").split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey || "Topic";
}

/**
 * Map DB doc to draft item shape.
 */
function toDraftItem(itemType, doc) {
  const topicKey = doc.topicKey || "";
  const specKey = deriveSpecKey(topicKey, doc);
  let titlePreview = "";
  let contentPreview = "";

  if (itemType === "flashcard") {
    titlePreview = (doc.front || "").slice(0, 80);
    contentPreview = (doc.back || "").slice(0, 120);
  } else if (itemType === "quizQuestion") {
    titlePreview = (doc.questionText || "").slice(0, 80);
    contentPreview = (doc.explanation || "").slice(0, 120);
  } else if (itemType === "examQuestion") {
    titlePreview = (doc.question || "").slice(0, 80);
    contentPreview = Array.isArray(doc.markScheme) ? doc.markScheme[0]?.slice(0, 120) : "";
  }

  return {
    itemType,
    itemId: String(doc._id),
    specKey: specKey || "",
    topicKey,
    topicTitle: topicDisplayName(topicKey),
    titlePreview,
    contentPreview,
    status: doc.status || "draft",
    generatedBy: doc.metadata?.generatedBy || AUTOPILOT_VALUE,
    createdAt: doc.createdAt,
    readinessSummary: doc.metadata?.readinessSummary ?? null,
    gapSummary: doc.metadata?.gapSummary ?? null,
  };
}

/**
 * Base query for autopilot drafts: status draft, metadata.generatedBy autopilot, not archived.
 */
function baseQuery() {
  return {
    status: "draft",
    [AUTOPILOT_META]: AUTOPILOT_VALUE,
    isArchived: { $ne: true },
  };
}

/**
 * Build model-specific query with filters.
 */
function buildQuery(Model, base, filters) {
  const { specKey, topicKey, status, generatorMode } = filters;
  const q = { ...base };
  if (status) q.status = status;
  if (generatorMode) q["metadata.generatorMode"] = generatorMode;

  if (specKey) {
    const specPattern = specKey.replace(/-/g, "[-_]");
    const specRegex = new RegExp(`^${specPattern}`, "i");
    if (Model === TopicQuizQuestion) {
      q.$or = [{ specKey: specRegex }, { topicKey: specRegex }, { topicKey: new RegExp(`^${specPattern}:`, "i") }];
    } else {
      q.$or = [{ topicKey: specRegex }, { topicKey: new RegExp(`^${specPattern}:`, "i") }];
    }
  }

  if (topicKey) {
    const escaped = topicKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    q.topicKey = { $regex: new RegExp(escaped, "i") };
  }

  return q;
}

/**
 * Get autopilot drafts with optional filters.
 */
async function getAutopilotDrafts(filters = {}) {
  const { itemType } = filters;
  const base = baseQuery();
  const types = itemType && ITEM_TYPES.includes(itemType) ? [itemType] : ITEM_TYPES;

  const items = [];
  const models = [
    [TopicFlashcard, "flashcard"],
    [TopicQuizQuestion, "quizQuestion"],
    [ExamQuestion, "examQuestion"],
  ];

  for (const [Model, type] of models) {
    if (!types.includes(type)) continue;
    const q = buildQuery(Model, base, filters);
    const docs = await Model.find(q).sort({ createdAt: -1 }).lean();
    for (const d of docs) {
      items.push(toDraftItem(type, d));
    }
  }

  items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return items;
}

/**
 * Get summary counts of autopilot drafts.
 */
async function getAutopilotDraftSummary(filters = {}) {
  const items = await getAutopilotDrafts(filters);
  const summary = {
    totalDrafts: items.length,
    flashcards: items.filter((i) => i.itemType === "flashcard").length,
    quizQuestions: items.filter((i) => i.itemType === "quizQuestion").length,
    examQuestions: items.filter((i) => i.itemType === "examQuestion").length,
  };
  return { summary, items };
}

/**
 * Approve a single autopilot item. Sets status to published, writes reviewer metadata.
 */
async function approveAutopilotItem({ itemType, itemId, reviewerId }) {
  if (!ITEM_TYPES.includes(itemType)) {
    throw new Error(`Unsupported item type: ${itemType}`);
  }
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new Error("Invalid itemId");
  }

  const reviewMeta = {
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
    reviewDecision: "approved",
  };

  if (itemType === "flashcard") {
    const doc = await TopicFlashcard.findOne({
      _id: itemId,
      [AUTOPILOT_META]: AUTOPILOT_VALUE,
      status: "draft",
      isArchived: { $ne: true },
    });
    if (!doc) return null;
    doc.status = "published";
    doc.metadata = { ...(doc.metadata || {}), ...reviewMeta };
    await doc.save();
    return toDraftItem("flashcard", doc);
  }

  if (itemType === "quizQuestion") {
    const doc = await TopicQuizQuestion.findOne({
      _id: itemId,
      [AUTOPILOT_META]: AUTOPILOT_VALUE,
      status: "draft",
      isArchived: { $ne: true },
    });
    if (!doc) return null;
    doc.status = "published";
    doc.publishedBy = reviewerId;
    doc.publishedAt = new Date();
    doc.metadata = { ...(doc.metadata || {}), ...reviewMeta };
    await doc.save();
    return toDraftItem("quizQuestion", doc);
  }

  if (itemType === "examQuestion") {
    const doc = await ExamQuestion.findOne({
      _id: itemId,
      [AUTOPILOT_META]: AUTOPILOT_VALUE,
      status: "draft",
      isArchived: { $ne: true },
    });
    if (!doc) return null;
    doc.status = "published";
    doc.metadata = { ...(doc.metadata || {}), ...reviewMeta };
    await doc.save();
    return toDraftItem("examQuestion", doc);
  }

  return null;
}

/**
 * Reject a single autopilot item. Sets isArchived=true, writes reviewer metadata.
 */
async function rejectAutopilotItem({ itemType, itemId, reviewerId, reason }) {
  if (!ITEM_TYPES.includes(itemType)) {
    throw new Error(`Unsupported item type: ${itemType}`);
  }
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new Error("Invalid itemId");
  }

  const reviewMeta = {
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
    reviewDecision: "rejected",
    reviewReason: reason || null,
  };

  let doc;
  if (itemType === "flashcard") {
    doc = await TopicFlashcard.findOne({
      _id: itemId,
      [AUTOPILOT_META]: AUTOPILOT_VALUE,
      status: "draft",
      isArchived: { $ne: true },
    });
    if (!doc) return null;
    doc.isArchived = true;
    doc.metadata = { ...(doc.metadata || {}), ...reviewMeta };
    await doc.save();
    return toDraftItem("flashcard", doc);
  }

  if (itemType === "quizQuestion") {
    doc = await TopicQuizQuestion.findOne({
      _id: itemId,
      [AUTOPILOT_META]: AUTOPILOT_VALUE,
      status: "draft",
      isArchived: { $ne: true },
    });
    if (!doc) return null;
    doc.isArchived = true;
    doc.metadata = { ...(doc.metadata || {}), ...reviewMeta };
    await doc.save();
    return toDraftItem("quizQuestion", doc);
  }

  if (itemType === "examQuestion") {
    doc = await ExamQuestion.findOne({
      _id: itemId,
      [AUTOPILOT_META]: AUTOPILOT_VALUE,
      status: "draft",
      isArchived: { $ne: true },
    });
    if (!doc) return null;
    doc.isArchived = true;
    doc.metadata = { ...(doc.metadata || {}), ...reviewMeta };
    await doc.save();
    return toDraftItem("examQuestion", doc);
  }

  return null;
}

/**
 * Bulk approve autopilot items.
 */
async function bulkApproveAutopilotItems({ items, reviewerId }) {
  const results = { approved: [], failed: [] };
  for (const { itemType, itemId } of items || []) {
    try {
      const r = await approveAutopilotItem({ itemType, itemId, reviewerId });
      if (r) results.approved.push({ itemType, itemId });
      else results.failed.push({ itemType, itemId, reason: "not found" });
    } catch (e) {
      results.failed.push({ itemType, itemId, reason: e.message || "error" });
    }
  }
  return results;
}

/**
 * Bulk reject autopilot items.
 */
async function bulkRejectAutopilotItems({ items, reviewerId, reason }) {
  const results = { rejected: [], failed: [] };
  for (const { itemType, itemId } of items || []) {
    try {
      const r = await rejectAutopilotItem({ itemType, itemId, reviewerId, reason });
      if (r) results.rejected.push({ itemType, itemId });
      else results.failed.push({ itemType, itemId, reason: "not found" });
    } catch (e) {
      results.failed.push({ itemType, itemId, reason: e.message || "error" });
    }
  }
  return results;
}

module.exports = {
  getAutopilotDrafts,
  getAutopilotDraftSummary,
  approveAutopilotItem,
  rejectAutopilotItem,
  bulkApproveAutopilotItems,
  bulkRejectAutopilotItems,
  ITEM_TYPES,
};
