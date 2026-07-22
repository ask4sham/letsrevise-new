/**
 * Narrow V1: server-side fresh-practice exclusions using contentType + contentId.
 * Lesson IDs map only when resolvable (examQuestionId / sourceQuestionId / bank ObjectIds).
 * pageId / derived-* IDs are never treated as bank content IDs.
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const PracticeSet = require("../models/PracticeSet");
const PracticeAttempt = require("../models/PracticeAttempt");
const { normalizeText } = require("../../lib/teacherBrain/examAwarePractice");

function contentKey(contentType, contentId) {
  return `${contentType}:${String(contentId)}`;
}

function isObjectIdString(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return mongoose.Types.ObjectId.isValid(s) && String(new mongoose.Types.ObjectId(s)) === s;
}

/** Normalised stem fingerprint for exact-duplicate bridge (not semantic families). */
function stemFingerprint(text) {
  const n = normalizeText(text || "");
  return n.length >= 12 ? n : "";
}

function addExamQuestionKey(keys, id) {
  if (!isObjectIdString(id)) return;
  keys.add(contentKey("exam_question", id));
}

function addQuizSourceKeys(keys, sourceQuestionId, sourceType) {
  if (!isObjectIdString(sourceQuestionId)) return;
  const st = String(sourceType || "").toLowerCase();
  if (st.includes("short")) {
    keys.add(contentKey("quiz_short", sourceQuestionId));
  } else if (st.includes("mcq") || st.includes("quiz")) {
    keys.add(contentKey("quiz_mcq", sourceQuestionId));
  } else if (st.includes("exam") || st.includes("past")) {
    keys.add(contentKey("exam_question", sourceQuestionId));
    keys.add(contentKey("past_paper_question", sourceQuestionId));
  } else {
    // Unknown source type: exclude against all bank types with this ObjectId (safe over-exclude).
    keys.add(contentKey("quiz_mcq", sourceQuestionId));
    keys.add(contentKey("quiz_short", sourceQuestionId));
    keys.add(contentKey("exam_question", sourceQuestionId));
    keys.add(contentKey("past_paper_question", sourceQuestionId));
  }
}

/**
 * Resolvable bank keys + stem fingerprints from a lesson document.
 * @returns {{ keys: Set<string>, fingerprints: Set<string> }}
 */
function collectExclusionsFromLessonDoc(lesson) {
  const keys = new Set();
  const fingerprints = new Set();
  if (!lesson) return { keys, fingerprints };

  for (const eq of lesson.examQuestions || []) {
    const qid = eq?.questionId?._id || eq?.questionId;
    addExamQuestionKey(keys, qid);
  }

  for (const page of lesson.pages || []) {
    for (const block of page.blocks || []) {
      if (!block || typeof block !== "object") continue;
      addExamQuestionKey(keys, block.examQuestionId);
      const stem =
        block.question ||
        block.prompt ||
        block.questionText ||
        (Array.isArray(block.questions) ? block.questions.map((q) => q?.question || q?.prompt || "").join(" ") : "");
      const fp = stemFingerprint(stem);
      if (fp) fingerprints.add(fp);

      if (Array.isArray(block.questions)) {
        for (const q of block.questions) {
          addQuizSourceKeys(keys, q?.sourceQuestionId, q?.sourceType || q?.type);
          const qfp = stemFingerprint(q?.question || q?.prompt || q?.questionText || "");
          if (qfp) fingerprints.add(qfp);
        }
      }
    }
  }

  for (const section of [lesson.quiz?.questions, lesson.assessment?.questions]) {
    if (!Array.isArray(section)) continue;
    for (const q of section) {
      addQuizSourceKeys(keys, q?.sourceQuestionId, q?.sourceType || q?.type);
      // lesson.quiz id is NOT a bank id — only use if it is a valid ObjectId AND sourceQuestionId missing
      // and source proves bank origin. Do not treat raw string lesson ids as bank ids.
      const qfp = stemFingerprint(q?.question || q?.prompt || "");
      if (qfp) fingerprints.add(qfp);
    }
  }

  return { keys, fingerprints };
}

async function collectLessonBankExclusions(lessonId) {
  if (!lessonId || !isObjectIdString(lessonId)) {
    return { keys: new Set(), fingerprints: new Set() };
  }
  const lesson = await Lesson.findById(lessonId)
    .select("pages quiz assessment examQuestions")
    .populate({ path: "examQuestions.questionId", select: "_id" })
    .lean();
  return collectExclusionsFromLessonDoc(lesson);
}

/**
 * Recent PracticeSet items + PracticeAttempt content keys for this student/topics.
 */
async function collectRecentStudentExclusions(studentId, topicKeys, { recentSetLimit = 5 } = {}) {
  const keys = new Set();
  if (!studentId) return keys;

  const topicList = (topicKeys || []).map((k) => String(k).trim()).filter(Boolean);
  const setQuery = { studentId };
  if (topicList.length) setQuery.topicKeys = { $in: topicList };

  const recentSets = await PracticeSet.find(setQuery)
    .sort({ createdAt: -1 })
    .limit(Math.max(1, recentSetLimit))
    .select("items")
    .lean();

  for (const set of recentSets) {
    for (const item of set.items || []) {
      if (item?.contentType && item?.contentId) {
        keys.add(contentKey(item.contentType, item.contentId));
      }
    }
  }

  const attemptQuery = {
    $or: [{ studentId }, { userId: studentId }],
  };
  if (topicList.length) {
    attemptQuery.topicKey = { $in: topicList };
  }

  const recentAttempts = await PracticeAttempt.find(attemptQuery)
    .sort({ createdAt: -1 })
    .limit(80)
    .select("contentType contentId sourceType sourceId questionId")
    .lean();

  for (const a of recentAttempts) {
    if (a.contentType && a.contentId) {
      keys.add(contentKey(a.contentType, a.contentId));
    }
    if (a.sourceType === "examQuestion" && a.sourceId) {
      keys.add(contentKey("exam_question", a.sourceId));
    }
    if (a.sourceType === "pastPaperQuestion" && a.sourceId) {
      keys.add(contentKey("past_paper_question", a.sourceId));
    }
    // Legacy lesson practice: questionId is ExamQuestion ObjectId when source=practice
    if (a.questionId && isObjectIdString(a.questionId)) {
      keys.add(contentKey("exam_question", a.questionId));
    }
  }

  return keys;
}

async function countLessonPracticeAttempts(studentId, lessonId) {
  if (!studentId || !lessonId || !isObjectIdString(lessonId)) return 0;
  return PracticeAttempt.countDocuments({
    source: "practice",
    lessonId,
    $or: [{ userId: studentId }, { studentId }],
  });
}

/**
 * Distinct questionIds recorded for dedicated lesson practice (source=practice).
 * These match PracticeSection q.id (ExamQuestion ObjectId strings).
 */
async function listLessonPracticeAttemptedQuestionIds(studentId, lessonId) {
  if (!studentId || !lessonId || !isObjectIdString(lessonId)) return [];
  const rows = await PracticeAttempt.find({
    source: "practice",
    lessonId,
    $or: [{ userId: studentId }, { studentId }],
    questionId: { $ne: null },
  })
    .select("questionId")
    .lean();
  const ids = new Set();
  for (const r of rows) {
    if (r.questionId) ids.add(String(r.questionId));
  }
  return [...ids];
}

function filterFreshCandidates(rawItems, { excludeKeys, excludeFingerprints }) {
  const keys = excludeKeys instanceof Set ? excludeKeys : new Set(excludeKeys || []);
  const fps = excludeFingerprints instanceof Set ? excludeFingerprints : new Set(excludeFingerprints || []);
  const out = [];
  const selectedKeys = new Set();

  for (const item of rawItems || []) {
    const key = contentKey(item.contentType, item.contentId);
    if (keys.has(key) || selectedKeys.has(key)) continue;

    const rowFp = item.row?.fingerprint ? String(item.row.fingerprint).trim() : "";
    if (rowFp && fps.has(rowFp)) continue;

    const stemFp = stemFingerprint(
      item.row?.questionText || item.row?.question || item.row?.prompt || ""
    );
    if (stemFp && fps.has(stemFp)) continue;

    selectedKeys.add(key);
    out.push(item);
  }
  return out;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  contentKey,
  isObjectIdString,
  stemFingerprint,
  collectExclusionsFromLessonDoc,
  collectLessonBankExclusions,
  collectRecentStudentExclusions,
  countLessonPracticeAttempts,
  listLessonPracticeAttemptedQuestionIds,
  filterFreshCandidates,
  shuffleInPlace,
  addQuizSourceKeys,
  addExamQuestionKey,
};
