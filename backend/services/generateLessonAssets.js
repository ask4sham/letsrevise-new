/**
 * Orchestrates AI draft generation for a lesson: topic-bank flashcards, quiz MCQs, exam questions.
 * All saves are status=draft only; never published.
 */
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const Lesson = require("../models/Lesson");
const { fingerprint: flashFp } = require("../utils/flashcardDedupe");
const { fingerprint: quizFp } = require("../utils/quizDedupe");
const { examQuestionFingerprint } = require("../utils/examQuestionDedupe");
const { extractLessonTextForAssets } = require("../utils/extractLessonTextForAssets");
const {
  validateFlashcardDraft,
  validateQuizMcqDraft,
  validateExamQuestionDraftForAiLessonBank,
  namespacedTopicKeyFromLesson,
} = require("../schemas/lessonAssetDrafts");
const { assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");
const { generateFlashcardsFromLesson } = require("./generateFlashcardsFromLesson");
const { generateQuizQuestionsFromLesson } = require("./generateQuizQuestionsFromLesson");
const { generateExamQuestionsFromLesson } = require("./generateExamQuestionsFromLesson");
const {
  scoreFlashcardDraft,
  scoreQuizMcqDraft,
  scoreExamDraft,
  metadataQualityPatch,
} = require("../utils/draftQualityScoring");

const META_SOURCE = "ai_lesson_assets";

/** @param {"flashcard"|"quiz"|"exam"} generationType */
function baseMetadata(lessonId, pageId, generationType, lesson) {
  const lu =
    lesson && lesson.updatedAt != null
      ? (lesson.updatedAt instanceof Date ? lesson.updatedAt : new Date(lesson.updatedAt)).toISOString()
      : new Date().toISOString();
  return {
    source: META_SOURCE,
    pendingReview: true,
    aiGenerated: true,
    generatedAt: new Date().toISOString(),
    lessonId: String(lessonId),
    lessonUpdatedAt: lu,
    generationType,
    ...(pageId ? { pageId: String(pageId) } : {}),
  };
}

/**
 * Before regenerating, remove prior AI lesson-asset drafts for this lesson so editors do not accumulate stale duplicates.
 * @param {import("mongoose").Types.ObjectId|string} ownerId
 * @param {import("mongoose").Types.ObjectId|string} lessonId
 * @param {{ flashcards?: boolean, quizQuestions?: boolean, examQuestions?: boolean }} types
 */
async function removeStaleAiLessonAssetDrafts(ownerId, lessonId, types) {
  const lid = String(lessonId);
  const oId = ownerId;
  if (types.flashcards) {
    await TopicFlashcard.deleteMany({
      ownerId: oId,
      status: "draft",
      "metadata.source": META_SOURCE,
      "metadata.lessonId": lid,
      $or: [{ "metadata.generationType": "flashcard" }, { "metadata.generationType": { $exists: false }, "metadata.kind": "flashcard" }],
    });
  }
  if (types.quizQuestions) {
    await TopicQuizQuestion.deleteMany({
      ownerId: oId,
      status: "draft",
      "metadata.source": META_SOURCE,
      "metadata.lessonId": lid,
      $or: [{ "metadata.generationType": "quiz" }, { "metadata.generationType": { $exists: false }, "metadata.kind": "quiz_mcq" }],
    });
  }
  if (types.examQuestions) {
    await ExamQuestion.deleteMany({
      teacherId: oId,
      status: "draft",
      "metadata.source": META_SOURCE,
      "metadata.lessonId": lid,
      $or: [{ "metadata.generationType": "exam" }, { "metadata.generationType": { $exists: false }, "metadata.kind": "exam" }],
    });
  }
}

/**
 * @param {Object} opts
 * @param {string} opts.lessonId
 * @param {ObjectId|string} opts.ownerId - teacher
 * @param {string} [opts.lesson] - optional preloaded lesson doc
 * @param {boolean} [opts.generateFlashcards=true]
 * @param {boolean} [opts.generateQuizQuestions=true]
 * @param {boolean} [opts.generateExamQuestions=false]
 * @returns {Promise<Object>}
 */
async function generateLessonAssets(opts) {
  const lesson =
    opts.lesson ||
    (await Lesson.findById(opts.lessonId).select(
      "title description content pages topicKey specKey subject level board topic subTopic teacherId organisationId"
    ));
  if (!lesson) {
    const err = new Error("Lesson not found");
    err.statusCode = 404;
    throw err;
  }

  const ns = namespacedTopicKeyFromLesson(lesson);
  if (ns.error) {
    const err = new Error(ns.error);
    err.statusCode = 400;
    err.code = "NO_TOPIC_KEY";
    throw err;
  }
  const { namespacedTopicKey, specKey } = ns;
  try {
    assertValidNamespacedTopicKey(specKey, namespacedTopicKey);
  } catch (e) {
    const err = new Error(e.message || "Invalid topicKey for this specification");
    err.statusCode = 400;
    err.code = e.code || "INVALID_TOPIC_KEY";
    throw err;
  }

  const { text: lessonText, pageIds } = extractLessonTextForAssets(lesson);
  const validPageIds = new Set(pageIds);
  if (!lessonText || lessonText.length < 80) {
    const err = new Error("Lesson has too little text content to generate assets (add page content or description).");
    err.statusCode = 400;
    err.code = "INSUFFICIENT_CONTENT";
    throw err;
  }

  const genFlags = {
    flashcards: opts.generateFlashcards !== false,
    quizQuestions: opts.generateQuizQuestions !== false,
    examQuestions: opts.generateExamQuestions === true,
  };

  const ownerId = lesson.teacherId || opts.ownerId;
  await removeStaleAiLessonAssetDrafts(ownerId, lesson._id, {
    flashcards: genFlags.flashcards,
    quizQuestions: genFlags.quizQuestions,
    examQuestions: genFlags.examQuestions,
  });

  const summary = { flashcards: 0, quizQuestions: 0, examQuestions: 0, skipped: [], errors: [] };
  const lessonUpdatedAtSnapshot =
    lesson.updatedAt != null
      ? (lesson.updatedAt instanceof Date ? lesson.updatedAt : new Date(lesson.updatedAt)).toISOString()
      : new Date().toISOString();

  const runOpts = {
    lesson,
    lessonText,
    pageIds,
    namespacedTopicKey,
    specKey,
    maxItems: 8,
  };

  /** @type {Array<{ front: string; back: string; pageId?: string }>} */
  let flashcardsRaw = [];
  if (genFlags.flashcards) {
    try {
      flashcardsRaw = await generateFlashcardsFromLesson({ ...runOpts, maxItems: 8 });
    } catch (e) {
      if (e.code === "LLM_NOT_CONFIGURED") throw e;
      summary.errors.push({ type: "flashcards", message: e.message || String(e) });
    }
  }

  for (const fc of flashcardsRaw) {
    const v = validateFlashcardDraft(fc, specKey, namespacedTopicKey, validPageIds);
    if (!v.ok) {
      summary.skipped.push({ type: "flashcard", reason: v.errors.join("; ") });
      continue;
    }
    const fp = flashFp(fc.front, fc.back);
    const exists = await TopicFlashcard.findOne({ ownerId, topicKey: namespacedTopicKey, fingerprint: fp }).lean();
    if (exists) {
      summary.skipped.push({ type: "flashcard", reason: "duplicate fingerprint" });
      continue;
    }
    try {
      await TopicFlashcard.create({
        ownerId,
        topicKey: namespacedTopicKey,
        specKey,
        subject: lesson.subject || "Biology",
        examBoard: lesson.board || "AQA",
        level: lesson.level || "GCSE",
        topic: lesson.subTopic || lesson.topic || "",
        front: fc.front.slice(0, 500),
        back: fc.back.slice(0, 2000),
        status: "draft",
        fingerprint: fp,
        metadata: {
          ...baseMetadata(lesson._id, fc.pageId, "flashcard", lesson),
          kind: "flashcard",
          ...metadataQualityPatch(
            scoreFlashcardDraft({ front: fc.front, back: fc.back, pageId: fc.pageId }),
            "heuristic"
          ),
        },
      });
      summary.flashcards += 1;
    } catch (e) {
      if (e.code === 11000) summary.skipped.push({ type: "flashcard", reason: "duplicate key" });
      else summary.errors.push({ type: "flashcard", message: e.message });
    }
  }

  /** @type {Array<{ questionText: string; choices: string[]; correctIndex: number; explanation: string; pageId?: string }>} */
  let quizRaw = [];
  if (genFlags.quizQuestions) {
    try {
      quizRaw = await generateQuizQuestionsFromLesson({ ...runOpts, maxItems: 6 });
    } catch (e) {
      summary.errors.push({ type: "quiz", message: e.message || String(e) });
    }
  }

  for (const q of quizRaw) {
    while (q.choices.length < 4) q.choices.push("");
    q.choices = q.choices.slice(0, 4).map((c) => String(c || "").trim());
    q.correctIndex = Math.min(Math.max(0, Number(q.correctIndex)), 3);
    const v = validateQuizMcqDraft(q, specKey, namespacedTopicKey, validPageIds);
    if (!v.ok) {
      summary.skipped.push({ type: "quiz", reason: v.errors.join("; ") });
      continue;
    }
    const fp = quizFp(q.questionText, q.choices, q.correctIndex, "quiz");
    const exists = await TopicQuizQuestion.findOne({ ownerId, topicKey: namespacedTopicKey, fingerprint: fp }).lean();
    if (exists) {
      summary.skipped.push({ type: "quiz", reason: "duplicate fingerprint" });
      continue;
    }
    try {
      await TopicQuizQuestion.create({
        ownerId,
        topicKey: namespacedTopicKey,
        specKey,
        type: "mcq",
        questionText: q.questionText,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        status: "draft",
        kind: "quiz",
        fingerprint: fp,
        metadata: {
          ...baseMetadata(lesson._id, q.pageId, "quiz", lesson),
          kind: "quiz_mcq",
          ...metadataQualityPatch(
            scoreQuizMcqDraft({
              questionText: q.questionText,
              choices: q.choices,
              explanation: q.explanation,
              correctIndex: q.correctIndex,
            }),
            "heuristic"
          ),
        },
      });
      summary.quizQuestions += 1;
    } catch (e) {
      if (e.code === 11000) summary.skipped.push({ type: "quiz", reason: "duplicate key" });
      else summary.errors.push({ type: "quiz", message: e.message });
    }
  }

  const EXAM_TARGET = 10;
  /** Exam questions */
  let examRaw = [];
  if (genFlags.examQuestions) {
    try {
      examRaw = await generateExamQuestionsFromLesson({ ...runOpts, maxItems: EXAM_TARGET });
    } catch (e) {
      if (e.code === "LLM_NOT_CONFIGURED") throw e;
      summary.errors.push({ type: "exam", message: e.message || String(e) });
    }
  }

  for (const ex of examRaw) {
    const t = String(ex.type || "").toLowerCase();
    if (t === "mcq" || (Array.isArray(ex.options) && ex.options.length > 0)) {
      summary.skipped.push({ type: "exam", reason: "MCQ or multiple-choice options are not saved to the Exam Question Bank" });
      continue;
    }
    if ((!ex.markScheme || !ex.markScheme.length) && ex.modelAnswer) {
      ex.markScheme = [String(ex.modelAnswer).trim()];
    }
    const v = validateExamQuestionDraftForAiLessonBank(ex, specKey, namespacedTopicKey, validPageIds);
    if (!v.ok) {
      summary.skipped.push({ type: "exam", reason: v.errors.join("; ") });
      continue;
    }
    const msStr = [...(ex.markScheme || []), ex.modelAnswer || ""].filter(Boolean).join("\n");
    const fp = examQuestionFingerprint({
      specKey,
      topicKey: namespacedTopicKey,
      question: ex.question,
      markScheme: msStr,
      marks: ex.marks,
    });
    const exists = await ExamQuestion.findOne({ teacherId: ownerId, fingerprint: fp }).lean();
    if (exists) {
      summary.skipped.push({ type: "exam", reason: "duplicate fingerprint" });
      continue;
    }
    const doc = {
      teacherId: ownerId,
      organisationId: lesson.organisationId || null,
      scope: "teacher",
      subject: lesson.subject || "Biology",
      examBoard: lesson.board || "AQA",
      level: lesson.level || "GCSE",
      topic: lesson.subTopic || lesson.topic || "",
      topicKey: namespacedTopicKey,
      type: "short",
      marks: ex.marks,
      question: ex.question,
      options: [],
      correctIndex: null,
      correctAnswer: ex.modelAnswer,
      markScheme: ex.markScheme,
      status: "draft",
      fingerprint: fp,
      metadata: {
        ...baseMetadata(lesson._id, ex.pageId, "exam", lesson),
        kind: "exam",
        commandWord: ex.commandWord || "",
        modelAnswer: ex.modelAnswer || "",
        ...metadataQualityPatch(
          scoreExamDraft({
            question: ex.question,
            marks: ex.marks,
            markScheme: ex.markScheme,
            type: ex.type,
            modelAnswer: ex.modelAnswer,
          }),
          "heuristic"
        ),
      },
    };
    try {
      await ExamQuestion.create(doc);
      summary.examQuestions += 1;
    } catch (e) {
      summary.errors.push({ type: "exam", message: e.message });
    }
  }

  const examSkippedInvalid = summary.skipped.filter((s) => s.type === "exam");

  return {
    lessonId: String(lesson._id),
    lessonUpdatedAtSnapshot,
    generated: {
      flashcards: summary.flashcards,
      quizQuestions: summary.quizQuestions,
      examQuestions: summary.examQuestions,
    },
    examQuestionStats: genFlags.examQuestions
      ? {
          requestedCount: EXAM_TARGET,
          llmReturnedCount: examRaw.length,
          insertedCount: summary.examQuestions,
          skippedInvalidCount: examSkippedInvalid.length,
          skippedInvalidReasons: examSkippedInvalid.slice(0, 12).map((s) => s.reason),
        }
      : undefined,
    skipped: summary.skipped,
    errors: summary.errors,
    status: summary.errors.length ? "partial" : "ok",
  };
}

module.exports = { generateLessonAssets, META_SOURCE };
