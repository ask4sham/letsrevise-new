/**
 * Content Graph Service — canonical relationship layer between taxonomy, lessons, flashcards, quizzes, exam questions.
 * Idempotent upserts; no duplicate edges. Uses contentCanonicalKey and topicKey utilities.
 */
const ContentNode = require("../models/ContentNode");
const ContentEdge = require("../models/ContentEdge");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const {
  taxonomyCanonicalKey,
  lessonCanonicalKey,
  flashcardCanonicalKey,
  examQuestionCanonicalKey,
  quizQuestionCanonicalKey,
} = require("../utils/contentCanonicalKey");
const { buildTopicKey, parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");
const { topicDisplayToCanonicalKey, topicToKey } = require("../utils/topicTaxonomy");
const { getMergedTaxonomyBySpecKey } = require("./adminTaxonomyService");
const mongoose = require("mongoose");

const NODE_TYPES = ["subject", "spec", "mainTopic", "subTopic", "lesson", "flashcard", "quizQuestion", "examQuestion", "revisionDraft"];
const EDGE_TYPES = ["contains", "belongs_to", "covers", "teaches", "uses", "derived_from", "references", "revision_of", "reports_issue_on", "recommended_for"];
const SOURCE_TYPES = ["system", "migration", "teacher", "admin", "ai"];

/**
 * Upsert taxonomy node. Idempotent.
 */
async function upsertTaxonomyNode({ subject, specKey, topicKey, title, nodeType, legacyKeys }) {
  const canonical = taxonomyCanonicalKey(specKey, topicKey);
  if (!canonical) return null;
  const s = (specKey || "").trim();
  const t = (topicKey || "").trim();
  const node = await ContentNode.findOneAndUpdate(
    { canonicalKey: canonical },
    {
      $set: {
        nodeType: nodeType || "subTopic",
        title: title || t || canonical,
        slug: (t || canonical).replace(/:/g, "-"),
        subject: subject || null,
        specKey: s || specKey || null,
        topicKey: t || topicKey || null,
        legacyKeys: legacyKeys || [],
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  return node;
}

/**
 * Upsert lesson node.
 */
async function upsertLessonNode(lesson) {
  if (!lesson || !lesson._id) return null;
  const canonical = lessonCanonicalKey(lesson._id);
  const doc = await ContentNode.findOneAndUpdate(
    { canonicalKey: canonical },
    {
      $set: {
        nodeType: "lesson",
        title: lesson.title || "Lesson",
        slug: (lesson.title || String(lesson._id)).toLowerCase().replace(/\s+/g, "-").slice(0, 80),
        subject: lesson.subject || null,
        specKey: lesson.specKey || parseTopicKey(lesson.topicKey || "").specKey || null,
        topicKey: lesson.topicKey || null,
        lessonId: lesson._id,
        flashcardId: null,
        quizQuestionId: null,
        examQuestionId: null,
        revisionDraftId: null,
        legacyKeys: [],
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  return doc;
}

/**
 * Upsert flashcard node.
 */
async function upsertFlashcardNode(flashcard) {
  if (!flashcard || !flashcard._id) return null;
  const canonical = flashcardCanonicalKey(flashcard._id);
  const doc = await ContentNode.findOneAndUpdate(
    { canonicalKey: canonical },
    {
      $set: {
        nodeType: "flashcard",
        title: (flashcard.front || "").slice(0, 80) || "Flashcard",
        slug: String(flashcard._id).slice(-8),
        subject: flashcard.subject || null,
        specKey: parseTopicKey(flashcard.topicKey || "").specKey || null,
        topicKey: flashcard.topicKey || null,
        lessonId: null,
        flashcardId: flashcard._id,
        quizQuestionId: null,
        examQuestionId: null,
        revisionDraftId: null,
        legacyKeys: [flashcard.topicKey].filter(Boolean),
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  return doc;
}

/**
 * Upsert exam question node.
 */
async function upsertExamQuestionNode(question) {
  if (!question || !question._id) return null;
  const canonical = examQuestionCanonicalKey(question._id);
  const doc = await ContentNode.findOneAndUpdate(
    { canonicalKey: canonical },
    {
      $set: {
        nodeType: "examQuestion",
        title: (question.question || "").slice(0, 80) || "Exam Question",
        slug: String(question._id).slice(-8),
        subject: question.subject || null,
        specKey: null,
        topicKey: question.topicKey || null,
        lessonId: null,
        flashcardId: null,
        quizQuestionId: null,
        examQuestionId: question._id,
        revisionDraftId: null,
        legacyKeys: [question.topicKey, question.unitKey].filter(Boolean),
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  return doc;
}

/**
 * Upsert quiz question node (TopicQuizQuestion).
 */
async function upsertQuizQuestionNode(question, lesson) {
  if (!question || !question._id) return null;
  const canonical = quizQuestionCanonicalKey(question._id);
  const doc = await ContentNode.findOneAndUpdate(
    { canonicalKey: canonical },
    {
      $set: {
        nodeType: "quizQuestion",
        title: (question.questionText || "").slice(0, 80) || "Quiz Question",
        slug: String(question._id).slice(-8),
        subject: null,
        specKey: question.specKey || parseTopicKey(question.topicKey || "").specKey || null,
        topicKey: question.topicKey || null,
        lessonId: lesson?._id || null,
        flashcardId: null,
        quizQuestionId: question._id,
        examQuestionId: null,
        revisionDraftId: null,
        legacyKeys: [question.topicKey].filter(Boolean),
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  return doc;
}

/**
 * Ensure edge exists. No duplicate. Race-safe: findOneAndUpdate with upsert.
 */
async function ensureEdge({ fromNodeId, toNodeId, edgeType, sourceType = "system", sourceId, metadata }) {
  if (!fromNodeId || !toNodeId || !edgeType) return null;
  const fromId = new mongoose.Types.ObjectId(fromNodeId);
  const toId = new mongoose.Types.ObjectId(toNodeId);
  const source = SOURCE_TYPES.includes(sourceType) ? sourceType : "system";
  const edge = await ContentEdge.findOneAndUpdate(
    { fromNodeId: fromId, toNodeId: toId, edgeType },
    {
      $setOnInsert: {
        fromNodeId: fromId,
        toNodeId: toId,
        edgeType,
        strength: 1,
        sourceType: source,
        sourceId: sourceId || null,
        notes: null,
        metadata: metadata || {},
      },
    },
    { upsert: true, new: true }
  );
  return edge;
}

/**
 * Resolve topic node. Uses topicKey resolver for legacy compatibility.
 */
async function resolveTopicNode(specKey, topicKey, unitKey) {
  const spec = specKey || DEFAULT_SPEC_LEGACY;
  const { topicKey: t, specKey: s } = parseTopicKey(topicKey || "") || {};
  const effectiveTopic = (t || topicKey || "").trim();
  const effectiveSpec = (s || spec || "").trim();
  if (!effectiveTopic) return null;
  const canonical = taxonomyCanonicalKey(effectiveSpec, effectiveTopic);
  let node = await ContentNode.findOne({ canonicalKey: canonical });
  if (!node) {
    const taxonomy = await getMergedTaxonomyBySpecKey(effectiveSpec);
    let title = effectiveTopic;
    if (taxonomy?.units) {
      for (const u of taxonomy.units || []) {
        const found = (u.topics || []).find((tp) => (tp.key || "").toLowerCase() === effectiveTopic.toLowerCase());
        if (found) {
          title = found.topic || found.key || effectiveTopic;
          break;
        }
      }
    }
    node = await upsertTaxonomyNode({
      specKey: effectiveSpec,
      topicKey: effectiveTopic,
      title,
      nodeType: "subTopic",
      legacyKeys: unitKey ? [`${unitKey}__${effectiveTopic}`] : [],
    });
  }
  return node;
}

/**
 * Derive topicKey from lesson when topicKey is missing (legacy mainTopic/subTopic).
 */
function deriveLessonTopicKey(lesson) {
  const raw = (lesson?.topicKey && String(lesson.topicKey).trim()) || "";
  if (raw) return raw;
  const specKey = (lesson?.specKey && String(lesson.specKey).trim()) || DEFAULT_SPEC_LEGACY;
  const display = (lesson?.subTopic || lesson?.topic || "").trim();
  if (!display) return "";
  const canonical = topicDisplayToCanonicalKey(display, specKey);
  if (canonical) return canonical;
  return topicToKey(display) || "";
}

/**
 * Link lesson to its topic.
 */
async function linkLessonToTopic(lesson) {
  const lessonNode = await upsertLessonNode(lesson);
  if (!lessonNode) return null;
  const specKey = (lesson?.specKey && String(lesson.specKey).trim()) || parseTopicKey(lesson?.topicKey || "").specKey || DEFAULT_SPEC_LEGACY;
  const topicKey = deriveLessonTopicKey(lesson);
  const topicOnly = (parseTopicKey(topicKey).topicKey || topicKey).trim();
  if (!topicOnly) return { lessonNode, topicNode: null };
  const topicNode = await resolveTopicNode(specKey, topicOnly, lesson?.mainTopic);
  if (!topicNode) return { lessonNode, topicNode: null };
  await ensureEdge({
    fromNodeId: lessonNode._id,
    toNodeId: topicNode._id,
    edgeType: "teaches",
    sourceType: "migration",
  });
  return { lessonNode, topicNode };
}

/**
 * Link flashcard to its topic.
 */
async function linkFlashcardToTopic(flashcard) {
  const flashNode = await upsertFlashcardNode(flashcard);
  if (!flashNode) return null;
  const specKey = parseTopicKey(flashcard.topicKey || "").specKey || DEFAULT_SPEC_LEGACY;
  const topicOnly = parseTopicKey(flashcard.topicKey || "").topicKey || flashcard.topicKey?.trim();
  const topicNode = await resolveTopicNode(specKey, topicOnly);
  if (!topicNode) return { flashNode, topicNode: null };
  await ensureEdge({
    fromNodeId: flashNode._id,
    toNodeId: topicNode._id,
    edgeType: "belongs_to",
    sourceType: "migration",
  });
  return { flashNode, topicNode };
}

/**
 * Link quiz question (TopicQuizQuestion) to topic.
 */
async function linkQuizQuestionToTopic(question) {
  if (!question || !question._id) return null;
  const qNode = await upsertQuizQuestionNode(question, null);
  if (!qNode) return null;
  const specKey = question.specKey || parseTopicKey(question.topicKey || "").specKey || DEFAULT_SPEC_LEGACY;
  const topicOnly = parseTopicKey(question.topicKey || "").topicKey || question.topicKey?.trim();
  const topicNode = await resolveTopicNode(specKey, topicOnly);
  if (!topicNode) return { questionNode: qNode, topicNode: null };
  await ensureEdge({
    fromNodeId: qNode._id,
    toNodeId: topicNode._id,
    edgeType: "covers",
    sourceType: "migration",
  });
  return { questionNode: qNode, topicNode };
}

/**
 * Link exam question to topic.
 */
async function linkQuestionToTopic(question) {
  const qNode = await upsertExamQuestionNode(question);
  if (!qNode) return null;
  const specKey = parseTopicKey(question.topicKey || "").specKey || DEFAULT_SPEC_LEGACY;
  const topicOnly = parseTopicKey(question.topicKey || "").topicKey || question.topicKey?.trim();
  const topicNode = await resolveTopicNode(specKey, topicOnly, question.unitKey);
  if (!topicNode) return { questionNode: qNode, topicNode: null };
  await ensureEdge({
    fromNodeId: qNode._id,
    toNodeId: topicNode._id,
    edgeType: "covers",
    sourceType: "migration",
  });
  return { questionNode: qNode, topicNode };
}

/**
 * Get topic graph: topic node + linked content.
 */
async function getTopicGraph(specKey, topicKey) {
  const topicNode = await resolveTopicNode(specKey, topicKey);
  if (!topicNode) return null;
  const edgesOut = await ContentEdge.find({ toNodeId: topicNode._id }).lean();
  const fromIds = [...new Set(edgesOut.map((e) => e.fromNodeId))];
  const nodes = await ContentNode.find({ _id: { $in: fromIds } }).lean();
  return {
    topicNode,
    linkedNodes: nodes,
    edgeCount: edgesOut.length,
  };
}

/**
 * Get lesson graph: lesson node + linked topic nodes.
 */
async function getLessonGraph(lessonId) {
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) return null;
  const lessonNode = await ContentNode.findOne({ lessonId: new mongoose.Types.ObjectId(lessonId) }).lean();
  if (!lessonNode) return { lessonNode: null, topicNodes: [], lesson };
  const edges = await ContentEdge.find({
    $or: [{ fromNodeId: lessonNode._id }, { toNodeId: lessonNode._id }],
  }).lean();
  const otherIds = edges.map((e) => (String(e.fromNodeId) === String(lessonNode._id) ? e.toNodeId : e.fromNodeId));
  const otherNodes = await ContentNode.find({ _id: { $in: otherIds } }).lean();
  return {
    lessonNode,
    topicNodes: otherNodes.filter((n) => n.nodeType === "subTopic" || n.nodeType === "mainTopic"),
    lesson,
  };
}

/**
 * Get coverage summary for a topic (used by contentCoverageService).
 */
async function getCoverageSummary(specKey, topicKey) {
  const topicNode = await resolveTopicNode(specKey, topicKey);
  if (!topicNode) return null;
  const edges = await ContentEdge.find({ toNodeId: topicNode._id, edgeType: { $in: ["teaches", "belongs_to", "covers"] } }).lean();
  const fromIds = edges.map((e) => e.fromNodeId);
  const nodes = await ContentNode.find({ _id: { $in: fromIds } }).lean();
  const byType = {};
  for (const n of nodes) {
    byType[n.nodeType] = (byType[n.nodeType] || 0) + 1;
  }
  return {
    lessonCount: byType.lesson || 0,
    flashcardCount: byType.flashcard || 0,
    quizCount: byType.quizQuestion || 0,
    examQuestionCount: byType.examQuestion || 0,
  };
}

module.exports = {
  upsertTaxonomyNode,
  upsertLessonNode,
  upsertFlashcardNode,
  upsertExamQuestionNode,
  upsertQuizQuestionNode,
  ensureEdge,
  linkLessonToTopic,
  linkFlashcardToTopic,
  linkQuizQuestionToTopic,
  linkQuestionToTopic,
  getTopicGraph,
  getLessonGraph,
  getCoverageSummary,
  resolveTopicNode,
};
