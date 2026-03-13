/**
 * PR-PRACTICE-LOOP-1: Generate practice set from ExamQuestion + PastPaperQuestion (teacher-authored only).
 * Slice 2: generateAndPersistPracticeSet — Quiz MCQ/Short + Exam + PastPaper, student-safe, persist PracticeSet.
 */
const ExamQuestion = require("../models/ExamQuestion");
const PastPaperQuestion = require("../models/PastPaperQuestion");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const PracticeSet = require("../models/PracticeSet");
const { assertValidSpecKey, assertValidSpecTopic, assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");
const { buildTopicKey, parseTopicKey, queryCandidates } = require("../utils/topicKey");

const OUTCOME_ENUM = ["correct", "partial", "wrong"];

const CONTENT_TYPES = ["quiz_mcq", "quiz_short", "exam_question", "past_paper_question"];

/** Map API skill (AO1/AO2) to model skill enum where present. */
function mapSkillForQuery(skillArr) {
  if (!skillArr || !Array.isArray(skillArr) || skillArr.length === 0) return null;
  const set = new Set();
  for (const s of skillArr) {
    const v = String(s).trim().toUpperCase();
    if (v === "AO1") set.add("recall");
    else if (v === "AO2") set.add("application");
    else if (v === "AO3") set.add("analysis");
    else if (["recall", "application", "analysis", "exam-technique"].includes(String(s).trim())) set.add(String(s).trim());
  }
  return set.size ? [...set] : null;
}

/**
 * @param {Object} opts
 * @param {ObjectId|string|null} opts.teacherId - optional; if set, only that teacher's content; else platform-wide for topic
 * @param {string} opts.specKey
 * @param {string} opts.topicKey - slug or namespaced
 * @param {number} opts.count - default 10, max 30
 * @returns {Promise<{ items: Array<{ sourceType, sourceId, teacherId, question, marks, topicKey }> }>}
 */
async function generatePracticeSet({ teacherId, specKey, topicKey, count = 10 }) {
  const limit = Math.min(30, Math.max(1, Number(count) || 10));

  assertValidSpecKey(specKey);
  const topicSlug = parseTopicKey(String(topicKey || "").trim()).topicKey || String(topicKey || "").trim();
  assertValidSpecTopic({ specKey, topicKey: topicSlug });

  const candidates = queryCandidates(specKey, topicSlug);
  const topicKeyQuery = candidates.length ? { $in: candidates } : topicSlug;

  const teacherFilter = teacherId ? { teacherId } : {};
  const ownerFilter = teacherId ? { ownerId: teacherId } : {};

  const [examQuestions, pastPaperQuestions] = await Promise.all([
    ExamQuestion.find({
      ...teacherFilter,
      topicKey: topicKeyQuery,
      status: { $in: ["draft", "published"] },
    })
      .select("_id teacherId topicKey question marks")
      .lean(),
    PastPaperQuestion.find({
      ...ownerFilter,
      topicKey: topicKeyQuery,
    })
      .select("_id ownerId topicKey question marks")
      .lean(),
  ]);

  const items = [];
  const namespacedTopicKey = buildTopicKey(specKey, topicSlug);

  examQuestions.forEach((q) => {
    items.push({
      sourceType: "examQuestion",
      sourceId: q._id,
      teacherId: q.teacherId,
      question: q.question || "",
      marks: q.marks ?? 1,
      topicKey: namespacedTopicKey,
    });
  });

  pastPaperQuestions.forEach((q) => {
    items.push({
      sourceType: "pastPaperQuestion",
      sourceId: q._id,
      teacherId: q.ownerId,
      question: q.question || "",
      marks: q.marks ?? null,
      topicKey: namespacedTopicKey,
    });
  });

  // Shuffle and take up to limit
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  const selected = items.slice(0, limit);

  return { items: selected };
}

// --- Slice 2: student-safe serializers (no correct answer / mark scheme) ---
function toStudentSafeQuizMcq(row) {
  return {
    contentType: "quiz_mcq",
    contentId: row._id,
    topicKey: row.topicKey,
    prompt: row.questionText || "",
    choices: Array.isArray(row.choices) ? [...row.choices] : [],
    metadata: {
      difficulty: row.difficulty ?? null,
      skill: row.skill ?? null,
      estimatedTimeSec: row.estimatedTimeSec ?? null,
    },
  };
}

function toStudentSafeQuizShort(row) {
  return {
    contentType: "quiz_short",
    contentId: row._id,
    topicKey: row.topicKey,
    prompt: row.questionText || "",
    metadata: {
      difficulty: row.difficulty ?? null,
      skill: row.skill ?? null,
      estimatedTimeSec: row.estimatedTimeSec ?? null,
    },
  };
}

function toStudentSafeExamQuestion(row) {
  const meta = {
    difficulty: row.difficulty ?? null,
    skill: row.skill ?? null,
    estimatedTimeSec: row.estimatedTimeSec ?? null,
  };
  if (row.type === "mcq" && Array.isArray(row.options)) {
    return { contentType: "exam_question", contentId: row._id, topicKey: row.topicKey, prompt: row.question || "", choices: [...row.options], metadata: meta };
  }
  return { contentType: "exam_question", contentId: row._id, topicKey: row.topicKey, prompt: row.question || "", metadata: meta };
}

function toStudentSafePastPaperQuestion(row) {
  return {
    contentType: "past_paper_question",
    contentId: row._id,
    topicKey: row.topicKey,
    prompt: row.question || "",
    metadata: {
      difficulty: row.difficulty ?? null,
      skill: row.skill ?? null,
      estimatedTimeSec: row.estimatedTimeSec ?? null,
    },
  };
}

/**
 * Slice 2: Generate practice set for student, persist PracticeSet, return student-safe items.
 * @param {Object} opts
 * @param {ObjectId|string} opts.studentId
 * @param {ObjectId|string} opts.teacherId - content owner (validated; TODO: allow-list when relationship model exists)
 * @param {string} opts.specKey
 * @param {string[]} opts.topicKeys - namespaced (specKey:topicSlug)
 * @param {number} opts.limit - 1–50
 * @param {string[]} opts.include - subset of CONTENT_TYPES
 * @param {number[]} [opts.difficulty]
 * @param {string[]} [opts.skill] - AO1/AO2 or recall/application/etc.
 */
async function generateAndPersistPracticeSet({ studentId, teacherId, specKey, topicKeys, limit = 10, include = CONTENT_TYPES, difficulty = null, skill = null }) {
  const cap = Math.min(50, Math.max(1, Number(limit) || 10));
  const types = Array.isArray(include) && include.length > 0 ? include : CONTENT_TYPES;
  const invalidType = types.find((t) => !CONTENT_TYPES.includes(t));
  if (invalidType) {
    const err = new Error(`Invalid include type: ${invalidType}. Must be one of: ${CONTENT_TYPES.join(", ")}`);
    err.code = "INVALID_INCLUDE";
    throw err;
  }

  assertValidSpecKey(specKey);
  const topicKeysTrimmed = (topicKeys || []).map((k) => String(k).trim()).filter(Boolean);
  if (topicKeysTrimmed.length === 0) {
    const err = new Error("At least one topicKey is required");
    err.code = "INVALID_TOPIC_KEYS";
    throw err;
  }
  for (const tk of topicKeysTrimmed) {
    assertValidNamespacedTopicKey(specKey, tk);
  }

  const difficultyFilter = Array.isArray(difficulty) && difficulty.length > 0 ? { $in: difficulty } : null;
  const skillMapped = mapSkillForQuery(skill);
  const skillFilter = skillMapped && skillMapped.length > 0 ? { $in: skillMapped } : null;

  const ownerFilter = teacherId ? { ownerId: teacherId } : {};
  const teacherFilter = teacherId ? { teacherId } : {};

  const rawItems = [];
  const seen = new Set();

  function dedupeKey(contentType, contentId) {
    return `${contentType}:${contentId}`;
  }
  function pushUnique(contentType, contentId, topicKey, row, serializer) {
    const key = dedupeKey(contentType, contentId.toString());
    if (seen.has(key)) return;
    seen.add(key);
    rawItems.push({ contentType, contentId, topicKey, row, serializer });
  }

  if (types.includes("quiz_mcq")) {
    const q = { ...ownerFilter, topicKey: { $in: topicKeysTrimmed }, type: "mcq", status: { $in: ["draft", "published"] } };
    if (difficultyFilter) q.difficulty = difficultyFilter;
    if (skillFilter) q.skill = skillFilter;
    const mcqs = await TopicQuizQuestion.find(q)
      .select("_id topicKey questionText choices difficulty skill estimatedTimeSec")
      .lean();
    mcqs.forEach((row) => pushUnique("quiz_mcq", row._id, row.topicKey, row, toStudentSafeQuizMcq));
  }
  if (types.includes("quiz_short")) {
    const q = { ...ownerFilter, topicKey: { $in: topicKeysTrimmed }, type: "short-answer", status: { $in: ["draft", "published"] } };
    if (difficultyFilter) q.difficulty = difficultyFilter;
    if (skillFilter) q.skill = skillFilter;
    const shorts = await TopicQuizQuestion.find(q)
      .select("_id topicKey questionText difficulty skill estimatedTimeSec")
      .lean();
    shorts.forEach((row) => pushUnique("quiz_short", row._id, row.topicKey, row, toStudentSafeQuizShort));
  }
  if (types.includes("exam_question")) {
    const q = { ...teacherFilter, topicKey: { $in: topicKeysTrimmed }, status: { $in: ["draft", "published"] } };
    if (difficultyFilter) q.difficulty = difficultyFilter;
    if (skillFilter) q.skill = skillFilter;
    const exams = await ExamQuestion.find(q)
      .select("_id topicKey type question options difficulty skill estimatedTimeSec")
      .lean();
    exams.forEach((row) => pushUnique("exam_question", row._id, row.topicKey, row, toStudentSafeExamQuestion));
  }
  if (types.includes("past_paper_question")) {
    const q = { ...ownerFilter, topicKey: { $in: topicKeysTrimmed } };
    if (difficultyFilter) q.difficulty = difficultyFilter;
    if (skillFilter) q.skill = skillFilter;
    const past = await PastPaperQuestion.find(q)
      .select("_id topicKey question difficulty skill estimatedTimeSec")
      .lean();
    past.forEach((row) => pushUnique("past_paper_question", row._id, row.topicKey, row, toStudentSafePastPaperQuestion));
  }

  const capped = rawItems.slice(0, cap);

  const setItems = capped.map(({ contentType, contentId, topicKey }) => ({ contentType, contentId, topicKey }));
  const practiceSet = await PracticeSet.create({
    studentId,
    teacherId,
    specKey,
    topicKeys: topicKeysTrimmed,
    items: setItems,
  });

  const studentSafeItems = capped.map(({ row, serializer }) => serializer(row));
  return { practiceSetId: practiceSet._id, items: studentSafeItems };
}

module.exports = { generatePracticeSet, generateAndPersistPracticeSet, OUTCOME_ENUM, CONTENT_TYPES };
