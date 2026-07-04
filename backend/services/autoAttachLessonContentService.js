/**
 * Auto-attach content from topic banks (TopicQuizQuestion, TopicFlashcard, optional ExamQuestion).
 * Fill-only when empty; deterministic selection (seed = lessonId); published first, then draft.
 * Graph-first: when resolving topic, try contentGraphService.getTopicGraph(specKey, topicKey) first.
 * If graph has linked content, use those IDs; otherwise fall back to legacy topicKey query.
 * Do not rename models: TopicQuizQuestion, TopicFlashcard, FlashcardBank, ExamQuestion.
 */
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const FlashcardBank = require("../models/FlashcardBank");
const ExamQuestion = require("../models/ExamQuestion");
const contentGraphService = require("./contentGraphService");
const { topicToKey, topicDisplayToCanonicalKey } = require("../utils/topicTaxonomy");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY, buildTopicKey } = require("../utils/topicKey");
const { resolveQuestionBankNamespacedTopicKey } = require("../utils/resolveTopicRuntimeKeys");
const {
  collectEmbeddedExamQuestionIds,
  buildExamQuestionFingerprints,
  filterDistinctPracticeExamQuestions,
} = require("../../lib/teacherBrain/examAwarePractice");

const FLASHCARD_LIMIT = 20;
const QUIZ_MCQ_TARGET = 10;
const QUIZ_SHORT_TARGET = 5;
const EXAM_QUESTION_LIMIT = 15;
/** General lesson-level quiz (topic bank auto-attach), not a specific page. */
const END_OF_LESSON_PAGE_ID = "END";

function hashString(s) {
  if (!s || typeof s !== "string") return 0;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function deterministicTake(items, seed, limit) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const withScore = items.map((item) => ({
    item,
    score: hashString(seed + String(item._id != null ? item._id : item.id)),
  }));
  withScore.sort((a, b) => a.score - b.score);
  return withScore.slice(0, limit).map((x) => x.item);
}

/**
 * @param {Object} opts
 * @param {string} opts.lessonId
 * @param {string|ObjectId} opts.actorUserId - teacher creating/editing (ownerId for bank lookups)
 * @param {boolean} [opts.includeAssessments=false]
 * @returns {Promise<{ ok: boolean; reason?: string; topicKey?: string; lessonId?: string; attached?: Object; lesson?: Object }>}
 */
async function autoAttachLessonContent({ lessonId, actorUserId, includeAssessments = false }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw Object.assign(new Error("Lesson not found"), { statusCode: 404 });

  const specKeyForLookup =
    (lesson.specKey && String(lesson.specKey).trim()) ||
    parseTopicKey(lesson.topicKey || "").specKey ||
    DEFAULT_SPEC_LEGACY;
  const topicKey =
    (lesson.topicKey && String(lesson.topicKey).trim()) ||
    (lesson.topic && topicDisplayToCanonicalKey(lesson.topic, specKeyForLookup)) ||
    (lesson.topic && topicToKey(lesson.topic)) ||
    "";

  if (!topicKey) {
    return { ok: false, reason: "NO_TOPIC_KEY", lessonId: String(lesson._id) };
  }

  const ownerId = actorUserId || lesson.teacherId;
  const seed = String(lessonId);
  const specKey =
    (lesson.specKey && String(lesson.specKey).trim()) ||
    parseTopicKey(topicKey).specKey ||
    DEFAULT_SPEC_LEGACY;
  const topicOnly = parseTopicKey(topicKey).topicKey || topicKey.trim().toLowerCase();
  const namespaced = topicKey.includes(":") ? topicKey.trim() : buildTopicKey(specKey, topicOnly);
  const bankNs = resolveQuestionBankNamespacedTopicKey(specKey, namespaced);
  const bankParsed = parseTopicKey(bankNs);
  const bankSpec = bankParsed.specKey || specKey;
  const bankTopicOnly = bankParsed.topicKey || topicOnly;
  const candidates = queryCandidates(bankSpec, bankTopicOnly);
  const topicQuery = candidates.length ? { $in: candidates } : bankNs;

  // Graph-first: try content graph for linked content IDs. Fall back to legacy topicQuery when empty/fails.
  let graphFlashcardIds = [];
  let graphQuizQuestionIds = [];
  let graphExamQuestionIds = [];
  try {
    const graph = await contentGraphService.getTopicGraph(specKey, topicOnly);
    if (graph?.linkedNodes?.length) {
      for (const n of graph.linkedNodes) {
        if (n.nodeType === "flashcard" && n.flashcardId) graphFlashcardIds.push(n.flashcardId);
        if (n.nodeType === "quizQuestion" && n.quizQuestionId) graphQuizQuestionIds.push(n.quizQuestionId);
        if (n.nodeType === "examQuestion" && n.examQuestionId) graphExamQuestionIds.push(n.examQuestionId);
      }
    }
  } catch (_) {
    // Graph unavailable: use legacy flow
  }

  const attached = {
    flashcards: { count: 0, source: "none" },
    quiz: { mcqCount: 0, shortCount: 0, source: "none" },
    assessments: { count: 0 },
  };

  // --- FLASHCARDS: only if lesson has none ---
  const existingFlashcards = Array.isArray(lesson.flashcards) ? lesson.flashcards : [];
  if (existingFlashcards.length === 0) {
    let cards = [];
    let pool = [];
    const fcBaseQuery = { isArchived: { $ne: true } };
    const fcIdFilter = graphFlashcardIds.length ? { _id: { $in: graphFlashcardIds } } : { topicKey: topicQuery };
    // 1) TopicFlashcard: graph-first when available, else topicQuery. Owner first (published, then draft)
    if (graphFlashcardIds.length) {
      let published = await TopicFlashcard.find({ ...fcBaseQuery, ...fcIdFilter, ownerId, status: "published" }).lean();
      pool = published;
      if (pool.length < FLASHCARD_LIMIT) {
        const draft = await TopicFlashcard.find({ ...fcBaseQuery, ...fcIdFilter, ownerId, status: "draft" }).lean();
        pool = [...published, ...draft];
      }
      if (pool.length === 0) {
        published = await TopicFlashcard.find({ ...fcBaseQuery, ...fcIdFilter, status: "published" }).lean();
        const draftPlatform = await TopicFlashcard.find({ ...fcBaseQuery, ...fcIdFilter, status: "draft" }).lean();
        pool = published.length < FLASHCARD_LIMIT ? [...published, ...draftPlatform] : published;
      }
    } else {
      let published = await TopicFlashcard.find({ ...fcBaseQuery, ownerId, topicKey: topicQuery, status: "published" }).lean();
      pool = published;
      if (pool.length < FLASHCARD_LIMIT) {
        const draft = await TopicFlashcard.find({ ...fcBaseQuery, ownerId, topicKey: topicQuery, status: "draft" }).lean();
        pool = [...published, ...draft];
      }
      if (pool.length === 0) {
        published = await TopicFlashcard.find({ ...fcBaseQuery, topicKey: topicQuery, status: "published" }).lean();
        if (published.length < FLASHCARD_LIMIT) {
          const draftPlatform = await TopicFlashcard.find({ ...fcBaseQuery, topicKey: topicQuery, status: "draft" }).lean();
          pool = [...published, ...draftPlatform];
        } else {
          pool = published;
        }
      }
    }
    const selectedTopic = deterministicTake(pool, seed + "flash", FLASHCARD_LIMIT);
    if (selectedTopic.length > 0) {
      cards = selectedTopic.map((c) => ({
        id: String(c._id),
        front: c.front || "",
        back: c.back || "",
        difficulty: 1,
        tags: ["auto-attached", "topic-bank", topicKey].filter(Boolean),
      }));
      attached.flashcards = { count: cards.length, source: "TopicFlashcard" };
    } else {
      // 3) Fallback: FlashcardBank (owner first)
      let bank = await FlashcardBank.findOne({
        ownerId,
        topicKey: candidates.length ? { $in: candidates } : topicKey,
      }).lean();
      if (!bank || !Array.isArray(bank.cards) || bank.cards.length === 0) {
        bank = await FlashcardBank.findOne({
          topicKey: candidates.length ? { $in: candidates } : topicKey,
        }).lean();
      }
      if (bank && Array.isArray(bank.cards) && bank.cards.length > 0) {
        const cardIds = bank.cards.map((_, i) => (bank._id ? String(bank._id) : "") + "_" + i);
        const selected = deterministicTake(
          bank.cards.map((c, i) => ({ _id: cardIds[i], front: c.front, back: c.back })),
          seed + "flashbank",
          FLASHCARD_LIMIT
        );
        cards = selected.map((c, i) => ({
          id: c._id || `fb_${i}`,
          front: c.front || "",
          back: c.back || "",
          difficulty: 1,
          tags: ["auto-attached", "FlashcardBank", topicKey].filter(Boolean),
        }));
        attached.flashcards = { count: cards.length, source: "FlashcardBank" };
      }
    }
    if (cards.length > 0) {
      lesson.flashcards = cards;
      lesson.markModified("flashcards");
    }
  }

  // --- LESSON QUIZ: only if empty ---
  const existingQuiz = (lesson.quiz && lesson.quiz.questions) || [];
  if (existingQuiz.length === 0) {
    const qBaseQuery = { kind: "quiz", isArchived: { $ne: true } };
    const qIdFilter = graphQuizQuestionIds.length ? { _id: { $in: graphQuizQuestionIds } } : { topicKey: topicQuery };
    let published = await TopicQuizQuestion.find({
      ...qBaseQuery,
      ...qIdFilter,
      ownerId,
      status: "published",
    }).lean();
    let pool = published;
    if (pool.length < QUIZ_MCQ_TARGET + QUIZ_SHORT_TARGET) {
      const draft = await TopicQuizQuestion.find({
        ...qBaseQuery,
        ...qIdFilter,
        ownerId,
        status: "draft",
      }).lean();
      pool = [...published, ...draft];
    }
    // Platform-wide fallback when owner has none
    if (pool.length === 0) {
      published = await TopicQuizQuestion.find({
        ...qBaseQuery,
        ...qIdFilter,
        status: "published",
      }).lean();
      if (published.length < QUIZ_MCQ_TARGET + QUIZ_SHORT_TARGET) {
        const draftPlatform = await TopicQuizQuestion.find({
          ...qBaseQuery,
          ...qIdFilter,
          status: "draft",
        }).lean();
        pool = [...published, ...draftPlatform];
      } else {
        pool = published;
      }
    }
    const mcq = pool.filter((q) => (q.type || "mcq") === "mcq");
    const short = pool.filter((q) => (q.type || "mcq") === "short-answer");
    const selectedMcq = deterministicTake(mcq, seed + "mcq", QUIZ_MCQ_TARGET);
    const selectedShort = deterministicTake(short, seed + "short", QUIZ_SHORT_TARGET);

    const toLessonQuestion = (q, i, prefix) => {
      const choices = Array.isArray(q.choices) ? q.choices : [];
      const correctIndex = Math.min(
        Math.max(0, Number(q.correctIndex)),
        Math.max(0, choices.length - 1)
      );
      const correctAnswerMcq = choices[correctIndex] || "";
      const correctAnswerShort = Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length
        ? q.acceptableAnswers.join("; ")
        : "";
      const type = (q.type || "mcq") === "short-answer" ? "short" : "mcq";
      return {
        id: `${prefix}_${i}`,
        type,
        question: q.questionText || "",
        options: type === "mcq" ? choices : undefined,
        correctAnswer: type === "mcq" ? correctAnswerMcq : correctAnswerShort,
        explanation: q.explanation || "",
        tags: ["auto-attached", "topic-bank", topicKey].filter(Boolean),
        difficulty: 1,
        marks: 1,
        pageId: END_OF_LESSON_PAGE_ID,
      };
    };

    const questions = [
      ...selectedMcq.map((q, i) => toLessonQuestion(q, i, "q_mcq")),
      ...selectedShort.map((q, i) => toLessonQuestion(q, i, "q_short")),
    ];

    if (questions.length > 0) {
      if (!lesson.quiz || typeof lesson.quiz !== "object") {
        lesson.quiz = { timeSeconds: 600, questions: [] };
      }
      lesson.quiz.questions = questions;
      lesson.markModified("quiz");
      attached.quiz = {
        mcqCount: selectedMcq.length,
        shortCount: selectedShort.length,
        source: "TopicQuizQuestion",
      };
    }
  }

  // --- OPTIONAL: ExamQuestion (assessments) ---
  if (includeAssessments && lesson.examQuestions !== undefined) {
    const existingIds = new Set(
      (lesson.examQuestions || []).map((e) => String(e.questionId))
    );
    const embeddedIds = collectEmbeddedExamQuestionIds(lesson.pages);
    for (const eid of embeddedIds) existingIds.add(eid);

    let examFingerprints = [];
    if (embeddedIds.size > 0) {
      const embeddedDocs = await ExamQuestion.find({ _id: { $in: [...embeddedIds] } })
        .select("_id question sharedStem parts markScheme imageUrl topic type")
        .lean();
      examFingerprints = buildExamQuestionFingerprints(embeddedDocs);
    }

    const eqBaseQuery = graphExamQuestionIds.length
      ? { _id: { $in: graphExamQuestionIds } }
      : { topicKey: topicQuery };
    const eqQuery = {
      ...eqBaseQuery,
      status: "published",
    };
    if (lesson.subject) eqQuery.subject = lesson.subject;
    if (lesson.board) eqQuery.examBoard = lesson.board;
    if (lesson.level) eqQuery.level = lesson.level;
    let eqPool = await ExamQuestion.find(eqQuery).lean();
    if (eqPool.length < EXAM_QUESTION_LIMIT) {
      const draftQuery = { ...eqQuery, status: "draft" };
      const draft = await ExamQuestion.find(draftQuery).lean();
      eqPool = [...eqPool, ...draft];
    }
    const distinctPool = filterDistinctPracticeExamQuestions(eqPool, {
      embeddedIds,
      fingerprints: examFingerprints,
    });
    const selected = deterministicTake(distinctPool, seed + "exam", EXAM_QUESTION_LIMIT);
    let added = 0;
    for (const q of selected) {
      const idStr = String(q._id);
      if (existingIds.has(idStr)) continue;
      existingIds.add(idStr);
      lesson.examQuestions.push({ questionId: q._id });
      added++;
    }
    if (added > 0) {
      lesson.markModified("examQuestions");
      attached.assessments = { count: added };
    }
  }

  await lesson.save();
  const updated = await Lesson.findById(lessonId).lean();

  // STRICT TAXONOMY: Thin coverage warning — never broaden to siblings; surface when few exact-match items
  const totalAttached =
    (attached.flashcards?.count || 0) + (attached.quiz?.mcqCount || 0) + (attached.quiz?.shortCount || 0) + (attached.assessments?.count || 0);
  const thinCoverage =
    totalAttached < 5 &&
    (attached.flashcards?.count === 0 || attached.quiz?.mcqCount + (attached.quiz?.shortCount || 0) === 0);
  const noFlashcards = (attached.flashcards?.count || 0) === 0 && existingFlashcards.length === 0;

  return {
    ok: true,
    topicKey,
    lessonId: String(lesson._id),
    attached,
    lesson: updated,
    ...(thinCoverage && {
      thinCoverage: true,
      warning: "Question bank coverage is limited for this sub-topic. Only exact-match questions were used.",
    }),
    ...(noFlashcards && {
      noFlashcardsForTopic: true,
      noFlashcardsMessage: "No flashcards found for this exact topic.",
    }),
  };
}

module.exports = { autoAttachLessonContent };
