#!/usr/bin/env node
/**
 * Backfill Content Graph — iterate taxonomy, lessons, flashcards, exam questions, quiz questions.
 * Create nodes and edges. Idempotent. Supports --dry-run.
 * Output: created counts by nodeType/edgeType, unresolved by model, sample mappings, summary.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const AdminTaxonomyItem = require("../models/AdminTaxonomyItem");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const ContentNode = require("../models/ContentNode");
const ContentEdge = require("../models/ContentEdge");
const contentGraphService = require("../services/contentGraphService");
const { getMergedTaxonomyBySpecKey } = require("../services/adminTaxonomyService");
const { queryCandidates, parseTopicKey } = require("../utils/topicKey");

const MAX_SAMPLE_UNRESOLVED = 10;

/** [CONTENT_GRAPH_UNRESOLVED] — grep-friendly prefix for unresolved mapping logs. */
function logUnresolved(model, id, specKey, topicKey, candidates) {
  console.error(
    "[CONTENT_GRAPH_UNRESOLVED] model=%s id=%s specKey=%s topicKey=%s candidates=%s",
    model,
    id,
    specKey || "",
    topicKey || "",
    JSON.stringify(candidates || [])
  );
}

/** Record for summary output. */
function recordUnresolved(collector, model, id, specKey, topicKey, candidates) {
  logUnresolved(model, id, specKey, topicKey, candidates);
  if (!collector[model]) collector[model] = [];
  collector[model].push({ id: String(id), specKey: specKey || "", topicKey: topicKey || "", candidates: candidates || [] });
}

const DRY_RUN = process.argv.includes("--dry-run");

async function getSpecKeys() {
  const items = await AdminTaxonomyItem.distinct("specKey");
  const staticSpecs = ["aqa-gcse-biology", "aqa-gcse-chemistry", "aqa-gcse-physics", "aqa-gcse-maths-foundation", "aqa-gcse-maths-higher", "aqa-l2-further-maths", "aqa-gcse-english-literature", "aqa-gcse-english-language"];
  const all = new Set([...staticSpecs, ...items]);
  return Array.from(all);
}

async function getAllTopicsBySpec() {
  const specKeys = await getSpecKeys();
  const out = {};
  for (const specKey of specKeys) {
    const taxonomy = await getMergedTaxonomyBySpecKey(specKey);
    if (!taxonomy || !taxonomy.units) continue;
    const topics = [];
    for (const u of taxonomy.units) {
      for (const t of u.topics || []) {
        const key = t.key || t.topicKey;
        if (key) topics.push({ key, unitKey: u.unitKey || u.unit });
      }
    }
    out[specKey] = topics;
  }
  return out;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/letsrevise");
  const summary = {
    taxonomyNodes: 0,
    lessons: 0,
    flashcards: 0,
    examQuestions: 0,
    quizQuestions: 0,
    skipped: 0,
    errors: [],
  };

  const unresolvedCollector = {};
  if (DRY_RUN) console.log("[backfill] DRY RUN — no writes\n");

  try {
    const topicsBySpec = await getAllTopicsBySpec();
    for (const [specKey, topics] of Object.entries(topicsBySpec)) {
      for (const { key } of topics) {
        try {
          if (!DRY_RUN) {
            const node = await contentGraphService.resolveTopicNode(specKey, key);
            if (node) summary.taxonomyNodes++;
          } else {
            summary.taxonomyNodes++;
          }
        } catch (e) {
          summary.errors.push(`taxonomy ${specKey}:${key}: ${e.message}`);
        }
      }
    }

    const lessons = await Lesson.find({}).lean();
    for (const lesson of lessons) {
      try {
        if (!DRY_RUN) {
          const result = await contentGraphService.linkLessonToTopic(lesson);
          if (result?.topicNode) summary.lessons++;
          else if (result?.lessonNode) {
            summary.skipped++;
            const specKey = lesson?.specKey || parseTopicKey(lesson?.topicKey || "").specKey || "";
            const topicKey = lesson?.topicKey || "";
            const candidates = specKey && topicKey ? queryCandidates(specKey, (topicKey || "").split(":").pop() || topicKey) : [];
            recordUnresolved(unresolvedCollector, "Lesson", String(lesson._id), specKey, topicKey, candidates);
          }
        } else {
          summary.lessons++;
        }
      } catch (e) {
        summary.errors.push(`lesson ${lesson._id}: ${e.message}`);
      }
    }

    const flashcards = await TopicFlashcard.find({ status: "published", isArchived: { $ne: true } }).lean();
    for (const fc of flashcards) {
      try {
        if (!DRY_RUN) {
          const result = await contentGraphService.linkFlashcardToTopic(fc);
          if (result?.topicNode) summary.flashcards++;
          else if (result?.flashNode) {
            summary.skipped++;
            const specKey = parseTopicKey(fc?.topicKey || "").specKey || "";
            const candidates = specKey && fc?.topicKey ? queryCandidates(specKey, (fc.topicKey || "").split(":").pop() || fc.topicKey) : [];
            recordUnresolved(unresolvedCollector, "TopicFlashcard", String(fc._id), specKey, fc?.topicKey || "", candidates);
          }
        } else {
          summary.flashcards++;
        }
      } catch (e) {
        summary.errors.push(`flashcard ${fc._id}: ${e.message}`);
      }
    }

    const examQuestions = await ExamQuestion.find({ status: "published" }).lean();
    for (const eq of examQuestions) {
      try {
        if (!DRY_RUN) {
          const result = await contentGraphService.linkQuestionToTopic(eq);
          if (result?.topicNode) summary.examQuestions++;
          else if (result?.questionNode) {
            summary.skipped++;
            const specKey = parseTopicKey(eq?.topicKey || "").specKey || "";
            const candidates = specKey && eq?.topicKey ? queryCandidates(specKey, (eq.topicKey || "").split(":").pop() || eq.topicKey, eq?.unitKey) : [];
            recordUnresolved(unresolvedCollector, "ExamQuestion", String(eq._id), specKey, eq?.topicKey || "", candidates);
          }
        } else {
          summary.examQuestions++;
        }
      } catch (e) {
        summary.errors.push(`examQuestion ${eq._id}: ${e.message}`);
      }
    }

    const quizQuestions = await TopicQuizQuestion.find({ status: "published", isArchived: { $ne: true } }).lean();
    for (const q of quizQuestions) {
      try {
        if (!DRY_RUN) {
          const result = await contentGraphService.linkQuizQuestionToTopic(q);
          if (result?.topicNode) summary.quizQuestions++;
          else if (result?.questionNode) {
            summary.skipped++;
            const specKey = q?.specKey || parseTopicKey(q?.topicKey || "").specKey || "";
            const candidates = specKey && q?.topicKey ? queryCandidates(specKey, (q.topicKey || "").split(":").pop() || q.topicKey) : [];
            recordUnresolved(unresolvedCollector, "TopicQuizQuestion", String(q._id), specKey, q?.topicKey || "", candidates);
          }
        } else {
          summary.quizQuestions++;
        }
      } catch (e) {
        summary.errors.push(`quizQuestion ${q._id}: ${e.message}`);
      }
    }

    if (!DRY_RUN) {
      const nodesByType = await ContentNode.aggregate([{ $group: { _id: "$nodeType", count: { $sum: 1 } } }]);
      const edgesByType = await ContentEdge.aggregate([{ $group: { _id: "$edgeType", count: { $sum: 1 } } }]);
      summary.nodesByType = Object.fromEntries(nodesByType.map((r) => [r._id, r.count]));
      summary.edgesByType = Object.fromEntries(edgesByType.map((r) => [r._id, r.count]));
    }
    const unresolvedByModel = {};
    for (const [model, items] of Object.entries(unresolvedCollector)) {
      unresolvedByModel[model] = items.length;
    }
    summary.unresolvedByModel = unresolvedByModel;
    const allUnresolved = Object.entries(unresolvedCollector).flatMap(([model, items]) =>
      items.map((i) => ({ model, ...i }))
    );
    summary.sampleUnresolved = allUnresolved.slice(0, MAX_SAMPLE_UNRESOLVED);

    if (DRY_RUN) {
      console.log("[backfill] DRY RUN SUMMARY");
      console.log("- Would process taxonomy topics:", summary.taxonomyNodes);
      console.log("- Would process lessons:", summary.lessons);
      console.log("- Would process flashcards:", summary.flashcards);
      console.log("- Would process exam questions:", summary.examQuestions);
      console.log("- Would process quiz questions:", summary.quizQuestions);
    }
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
