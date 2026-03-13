/**
 * PR-014.1: Publish gate validator — deterministic rules to block/warn before publishing generated content.
 */
const Lesson = require("../../models/Lesson");
const TopicFlashcard = require("../../models/TopicFlashcard");
const TopicQuizQuestion = require("../../models/TopicQuizQuestion");
const ExamQuestion = require("../../models/ExamQuestion");
const ContentGenerationJob = require("../../models/ContentGenerationJob");

const PLACEHOLDER_PATTERNS = [/^Draft\s*—\s*/i, /\bTODO\b/i, /\bTBD\b/i];

function hasPlaceholder(str) {
  if (!str || typeof str !== "string") return false;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(str.trim()));
}

/**
 * @param {Object} opts
 * @param {string} [opts.lessonId]
 * @param {string} [opts.topicKey]
 * @param {string} [opts.specKey]
 * @param {string} [opts.scope] "lesson"|"flashcards"|"quiz"|"exam"|"starterPack"
 * @param {string} [opts.jobId]
 * @returns {Promise<{ ok: boolean, blocks: number, warns: number, issues: Array<{level,type,entityId,message,fixPath}>, summaryByType: Object }>}
 */
async function validatePublishableContent({ lessonId, topicKey, specKey, scope = "starterPack", jobId }) {
  const issues = [];
  const summaryByType = { lesson: { blocks: 0, warns: 0 }, quiz: { blocks: 0, warns: 0 }, flashcard: { blocks: 0, warns: 0 }, exam: { blocks: 0, warns: 0 } };

  let lesson, flashcards = [], quizQuestions = [], examQuestions = [];
  let jobTopicKey = topicKey;
  let jobSpecKey = specKey;

  if (scope === "starterPack" && jobId) {
    const job = await ContentGenerationJob.findById(jobId).lean();
    if (!job) {
      return {
        ok: false,
        blocks: 1,
        warns: 0,
        issues: [{ level: "block", type: "lesson", entityId: jobId, message: "Job not found", fixPath: "" }],
        summaryByType,
      };
    }
    jobTopicKey = job.topicKey;
    jobSpecKey = job.specKey;

    if (job.outputs?.lessonId) {
      lesson = await Lesson.findById(job.outputs.lessonId).lean();
    }
    if (Array.isArray(job.outputs?.flashcardIds) && job.outputs.flashcardIds.length > 0) {
      flashcards = await TopicFlashcard.find({ _id: { $in: job.outputs.flashcardIds } }).lean();
    }
    if (Array.isArray(job.outputs?.quizQuestionIds) && job.outputs.quizQuestionIds.length > 0) {
      quizQuestions = await TopicQuizQuestion.find({ _id: { $in: job.outputs.quizQuestionIds } }).lean();
    }
    if (Array.isArray(job.outputs?.examQuestionIds) && job.outputs.examQuestionIds.length > 0) {
      examQuestions = await ExamQuestion.find({ _id: { $in: job.outputs.examQuestionIds } }).lean();
    }
  } else if (lessonId) {
    lesson = await Lesson.findById(lessonId).lean();
    jobTopicKey = lesson?.topicKey || topicKey;
  }

  const enc = (s) => encodeURIComponent(String(s || ""));

  // --- Lesson rules ---
  if (lesson) {
    if (!Array.isArray(lesson.pages) || lesson.pages.length === 0) {
      issues.push({ level: "block", type: "lesson", entityId: String(lesson._id), message: "Lesson must have at least 1 page", fixPath: `/edit-lesson/${lesson._id}#pages` });
      summaryByType.lesson.blocks++;
    } else {
      let hasContent = false;
      for (let pi = 0; pi < lesson.pages.length; pi++) {
        const page = lesson.pages[pi];
        const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
        let pageHasContent = false;
        for (let bi = 0; bi < blocks.length; bi++) {
          const b = blocks[bi];
          const ct = String(b?.type || "").toLowerCase();
          const content = (b?.content || b?.prompt || "").trim();
          if (["text", "keyidea", "examtip", "commonmistake", "stretch"].includes(ct) && content) pageHasContent = true;
          if (ct === "checkpoint") {
            const q = (b?.prompt || "").trim();
            const a = (b?.correctAnswer || "").trim();
            if (!q || !a) {
              issues.push({ level: "block", type: "lesson", entityId: `${lesson._id}-p${pi}-b${bi}`, message: `Checkpoint on page ${pi + 1} missing question or answer`, fixPath: `/edit-lesson/${lesson._id}?pageId=${page?.pageId || pi}#block-${bi}` });
              summaryByType.lesson.blocks++;
            }
          }
        }
        if (pageHasContent) hasContent = true;
      }
      if (!hasContent) {
        issues.push({ level: "block", type: "lesson", entityId: String(lesson._id), message: "Lesson must have at least 1 non-empty content block", fixPath: `/edit-lesson/${lesson._id}#pages` });
        summaryByType.lesson.blocks++;
      }
    }
    if (hasPlaceholder(lesson.title)) {
      issues.push({ level: "warn", type: "lesson", entityId: String(lesson._id), message: "Lesson title contains placeholder (TODO, TBD, Draft —)", fixPath: `/edit-lesson/${lesson._id}#title` });
      summaryByType.lesson.warns++;
    }
  }

  // --- Flashcard rules ---
  for (const fc of flashcards) {
    const fid = String(fc._id);
    const front = (fc.front || "").trim();
    const back = (fc.back || "").trim();
    if (!front) {
      issues.push({ level: "block", type: "flashcard", entityId: fid, message: "Flashcard front is empty", fixPath: `/teacher/topic-banks/flashcards?topicKey=${enc(jobTopicKey)}&highlightId=${fid}` });
      summaryByType.flashcard.blocks++;
    }
    if (!back) {
      issues.push({ level: "block", type: "flashcard", entityId: fid, message: "Flashcard back is empty", fixPath: `/teacher/topic-banks/flashcards?topicKey=${enc(jobTopicKey)}&highlightId=${fid}` });
      summaryByType.flashcard.blocks++;
    }
  }

  // --- Quiz rules ---
  for (const q of quizQuestions) {
    const qid = String(q._id);
    const questionText = (q.questionText || "").trim();
    const type = (q.type || "mcq").toLowerCase();

    if (!questionText) {
      issues.push({ level: "block", type: "quiz", entityId: qid, message: "Quiz question text is empty", fixPath: `/teacher/topic-banks/quizzes?topicKey=${enc(jobTopicKey)}&highlightId=${qid}` });
      summaryByType.quiz.blocks++;
    }

    if (type === "mcq") {
      const choices = Array.isArray(q.choices) ? q.choices : [];
      if (choices.length < 2) {
        issues.push({ level: "block", type: "quiz", entityId: qid, message: "MCQ must have at least 2 options", fixPath: `/teacher/topic-banks/quizzes?topicKey=${enc(jobTopicKey)}&highlightId=${qid}` });
        summaryByType.quiz.blocks++;
      }
      const ci = Number(q.correctIndex);
      if (!Number.isFinite(ci) || ci < 0 || ci >= choices.length) {
        issues.push({ level: "block", type: "quiz", entityId: qid, message: "MCQ correctIndex out of bounds or invalid", fixPath: `/teacher/topic-banks/quizzes?topicKey=${enc(jobTopicKey)}&highlightId=${qid}` });
        summaryByType.quiz.blocks++;
      } else {
        const correctOpt = (choices[ci] || "").trim();
        if (!correctOpt) {
          issues.push({ level: "block", type: "quiz", entityId: qid, message: "MCQ correct option is empty", fixPath: `/teacher/topic-banks/quizzes?topicKey=${enc(jobTopicKey)}&highlightId=${qid}` });
          summaryByType.quiz.blocks++;
        }
      }
    } else {
      const answers = Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [];
      if (answers.length === 0) {
        issues.push({ level: "block", type: "quiz", entityId: qid, message: "Short-answer question must have at least one acceptable answer", fixPath: `/teacher/topic-banks/quizzes?topicKey=${enc(jobTopicKey)}&highlightId=${qid}` });
        summaryByType.quiz.blocks++;
      }
    }
  }

  // --- Exam question rules ---
  for (const eq of examQuestions) {
    const eqid = String(eq._id);
    const question = (eq.question || "").trim();
    const markScheme = Array.isArray(eq.markScheme) ? eq.markScheme : [];
    const hasMarkScheme = markScheme.some((m) => String(m || "").trim());
    const marks = Number(eq.marks);

    if (!question) {
      issues.push({ level: "block", type: "exam", entityId: eqid, message: "Exam question text is empty", fixPath: `/teacher/exam-question-bank?topicKey=${enc(jobTopicKey)}&highlightId=${eqid}` });
      summaryByType.exam.blocks++;
    }
    if (!hasMarkScheme) {
      issues.push({ level: "block", type: "exam", entityId: eqid, message: "Exam question mark scheme is empty", fixPath: `/teacher/exam-question-bank?topicKey=${enc(jobTopicKey)}&highlightId=${eqid}` });
      summaryByType.exam.blocks++;
    }
    if (!Number.isInteger(marks) || marks < 1) {
      issues.push({ level: "block", type: "exam", entityId: eqid, message: "Exam question marks must be a positive integer", fixPath: `/teacher/exam-question-bank?topicKey=${enc(jobTopicKey)}&highlightId=${eqid}` });
      summaryByType.exam.blocks++;
    }
  }

  const blocks = issues.filter((i) => i.level === "block").length;
  const warns = issues.filter((i) => i.level === "warn").length;
  const ok = blocks === 0;

  return {
    ok,
    blocks,
    warns,
    issues,
    summaryByType,
  };
}

/**
 * PR-014.1a: Validate starter pack publishability with ownership check.
 * Teachers can only check their own job; admins can check any.
 * @param {{ jobId: string, user: { _id?, userId?, id? } }}
 * @returns {Promise<{ ok, blocks, warns, issues: Array<{level,type,entityId,message,fixLink}>, summaryByType }>}
 */
async function validateStarterPackPublishability({ jobId, user }) {
  const userId = user?._id || user?.userId || user?.id;
  if (!userId) {
    return { ok: false, blocks: 1, warns: 0, issues: [{ level: "block", type: "lesson", entityId: "", message: "Authentication required", fixLink: "" }], summaryByType: { lesson: { blocks: 0, warns: 0 }, flashcard: { blocks: 0, warns: 0 }, quiz: { blocks: 0, warns: 0 }, exam: { blocks: 0, warns: 0 } } };
  }

  const job = await ContentGenerationJob.findById(jobId).lean();
  if (!job) {
    return { ok: false, blocks: 1, warns: 0, issues: [{ level: "block", type: "lesson", entityId: jobId, message: "Job not found", fixLink: "" }], summaryByType: { lesson: { blocks: 0, warns: 0 }, flashcard: { blocks: 0, warns: 0 }, quiz: { blocks: 0, warns: 0 }, exam: { blocks: 0, warns: 0 } } };
  }

  const isAdmin = (user?.userType || user?.role || "").toString().toLowerCase() === "admin" || user?.isAdmin === true;
  const isOwner = String(job.requestedBy) === String(userId);
  if (!isOwner && !isAdmin) {
    return { ok: false, blocks: 1, warns: 0, issues: [{ level: "block", type: "lesson", entityId: jobId, message: "Access denied: you can only check your own jobs", fixLink: "" }], summaryByType: { lesson: { blocks: 0, warns: 0 }, flashcard: { blocks: 0, warns: 0 }, quiz: { blocks: 0, warns: 0 }, exam: { blocks: 0, warns: 0 } } };
  }

  const result = await validatePublishableContent({ scope: "starterPack", jobId });
  const issues = (result.issues || []).map((i) => ({ ...i, fixLink: i.fixPath || i.fixLink || "" }));
  return { ...result, issues };
}

module.exports = { validatePublishableContent, validateStarterPackPublishability };
