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

/** Higher-tier challenge V1: command words in stem (no dedicated commandWord field). */
const CHALLENGE_COMMAND_RE =
  /\b(evaluat(?:e|ion)|analys(?:e|is)|analyz(?:e|is)|compar(?:e|ison)|justify|explain)\b/i;

function getQuestionPromptText(row) {
  return String(row?.question || row?.questionText || row?.prompt || "");
}

/**
 * Strong challenge match using existing fields only (OR heuristic).
 * @param {object} row
 * @returns {boolean}
 */
function isStrongChallengeQuestion(row) {
  if (!row || typeof row !== "object") return false;
  const diff = Number(row.difficulty);
  const marks = Number(row.marks);
  const skill = String(row.skill || "").toLowerCase().trim();
  const level = String(row.level || "").toLowerCase().trim();
  const text = getQuestionPromptText(row);

  if (Number.isFinite(diff) && diff >= 4) return true;
  if (Number.isFinite(marks) && marks >= 4) return true;
  if (skill === "analysis" || skill === "exam-technique") return true;
  if (CHALLENGE_COMMAND_RE.test(text)) return true;
  if (level === "higher") return true;
  if (/\b(grade\s*[89]|stretch|challenge)\b/i.test(text)) return true;
  return false;
}

/**
 * Soft ranking score for challenge ordering / fallback.
 * Higher = harder / more challenge-like.
 * @param {object} row
 * @returns {number}
 */
function challengeRankScore(row) {
  if (!row || typeof row !== "object") return 0;
  let score = 0;
  const diff = Number(row.difficulty);
  const marks = Number(row.marks);
  const skill = String(row.skill || "").toLowerCase().trim();
  const level = String(row.level || "").toLowerCase().trim();
  const text = getQuestionPromptText(row);

  if (Number.isFinite(diff)) score += diff * 10;
  if (Number.isFinite(marks)) score += Math.min(marks, 8) * 3;
  if (skill === "analysis") score += 25;
  else if (skill === "exam-technique") score += 20;
  else if (skill === "application") score += 8;
  if (CHALLENGE_COMMAND_RE.test(text)) score += 18;
  if (level === "higher") score += 12;
  if (/\b(grade\s*[89]|stretch|challenge)\b/i.test(text)) score += 15;
  if (isStrongChallengeQuestion(row)) score += 5;
  return score;
}

/**
 * Select challenge items: strong matches first, then highest-ranked fallback.
 * Never returns empty when rawItems is non-empty.
 * @param {Array<{ row: object }>} rawItems
 * @param {number} cap
 * @returns {Array}
 */
function selectChallengePracticeItems(rawItems, cap) {
  const list = Array.isArray(rawItems) ? rawItems.slice() : [];
  const limit = Math.min(Math.max(1, Number(cap) || 10), Math.max(1, list.length || 1));
  if (list.length === 0) return [];

  const ranked = list
    .map((item, idx) => ({ item, idx, score: challengeRankScore(item.row) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  const strong = ranked.filter(({ item }) => isStrongChallengeQuestion(item.row));
  if (strong.length >= limit) {
    return strong.slice(0, limit).map((x) => x.item);
  }

  const used = new Set(strong.map((x) => x.idx));
  const out = strong.map((x) => x.item);
  for (const entry of ranked) {
    if (out.length >= limit) break;
    if (used.has(entry.idx)) continue;
    out.push(entry.item);
    used.add(entry.idx);
  }
  return out;
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
function buildStudentSafeMetadata(row, { challengeMode = false } = {}) {
  const marks = row.marks != null && Number.isFinite(Number(row.marks)) ? Number(row.marks) : null;
  const meta = {
    difficulty: row.difficulty ?? null,
    skill: row.skill ?? null,
    marks,
    estimatedTimeSec: row.estimatedTimeSec ?? null,
  };
  if (challengeMode) {
    meta.challenge = isStrongChallengeQuestion(row);
    if (Number.isFinite(Number(row.difficulty)) && Number(row.difficulty) >= 4) {
      meta.badge = "Grade 8/9";
    } else if (meta.challenge) {
      meta.badge = "Challenge";
    }
  }
  return meta;
}

function toStudentSafeQuizMcq(row, opts) {
  return {
    contentType: "quiz_mcq",
    contentId: row._id,
    topicKey: row.topicKey,
    prompt: row.questionText || "",
    choices: Array.isArray(row.choices) ? [...row.choices] : [],
    metadata: buildStudentSafeMetadata(row, opts),
  };
}

function toStudentSafeQuizShort(row, opts) {
  return {
    contentType: "quiz_short",
    contentId: row._id,
    topicKey: row.topicKey,
    prompt: row.questionText || "",
    metadata: buildStudentSafeMetadata(row, opts),
  };
}

function toStudentSafeExamQuestion(row, opts) {
  const meta = buildStudentSafeMetadata(row, opts);
  if (row.type === "mcq" && Array.isArray(row.options)) {
    return { contentType: "exam_question", contentId: row._id, topicKey: row.topicKey, prompt: row.question || "", choices: [...row.options], metadata: meta };
  }
  return { contentType: "exam_question", contentId: row._id, topicKey: row.topicKey, prompt: row.question || "", metadata: meta };
}

function toStudentSafePastPaperQuestion(row, opts) {
  return {
    contentType: "past_paper_question",
    contentId: row._id,
    topicKey: row.topicKey,
    prompt: row.question || "",
    metadata: buildStudentSafeMetadata(row, opts),
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
 * @param {string} [opts.mode] - "standard" (default) or "challenge"
 */
async function generateAndPersistPracticeSet({
  studentId,
  teacherId,
  specKey,
  topicKeys,
  limit = 10,
  include = CONTENT_TYPES,
  difficulty = null,
  skill = null,
  mode = "standard",
}) {
  const cap = Math.min(50, Math.max(1, Number(limit) || 10));
  const types = Array.isArray(include) && include.length > 0 ? include : CONTENT_TYPES;
  const invalidType = types.find((t) => !CONTENT_TYPES.includes(t));
  if (invalidType) {
    const err = new Error(`Invalid include type: ${invalidType}. Must be one of: ${CONTENT_TYPES.join(", ")}`);
    err.code = "INVALID_INCLUDE";
    throw err;
  }

  const challengeMode = String(mode || "standard").toLowerCase() === "challenge";

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

  // Challenge mode ranks in-memory; do not also hard-filter Mongo by difficulty/skill.
  const difficultyFilter =
    !challengeMode && Array.isArray(difficulty) && difficulty.length > 0 ? { $in: difficulty } : null;
  const skillMapped = !challengeMode ? mapSkillForQuery(skill) : null;
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
      .select("_id topicKey questionText choices difficulty skill estimatedTimeSec marks")
      .lean();
    mcqs.forEach((row) => pushUnique("quiz_mcq", row._id, row.topicKey, row, toStudentSafeQuizMcq));
  }
  if (types.includes("quiz_short")) {
    const q = { ...ownerFilter, topicKey: { $in: topicKeysTrimmed }, type: "short-answer", status: { $in: ["draft", "published"] } };
    if (difficultyFilter) q.difficulty = difficultyFilter;
    if (skillFilter) q.skill = skillFilter;
    const shorts = await TopicQuizQuestion.find(q)
      .select("_id topicKey questionText difficulty skill estimatedTimeSec marks")
      .lean();
    shorts.forEach((row) => pushUnique("quiz_short", row._id, row.topicKey, row, toStudentSafeQuizShort));
  }
  if (types.includes("exam_question")) {
    const q = { ...teacherFilter, topicKey: { $in: topicKeysTrimmed }, status: { $in: ["draft", "published"] } };
    if (difficultyFilter) q.difficulty = difficultyFilter;
    if (skillFilter) q.skill = skillFilter;
    const exams = await ExamQuestion.find(q)
      .select("_id topicKey type question options difficulty skill estimatedTimeSec marks level")
      .lean();
    exams.forEach((row) => pushUnique("exam_question", row._id, row.topicKey, row, toStudentSafeExamQuestion));
  }
  if (types.includes("past_paper_question")) {
    const q = { ...ownerFilter, topicKey: { $in: topicKeysTrimmed } };
    if (difficultyFilter) q.difficulty = difficultyFilter;
    if (skillFilter) q.skill = skillFilter;
    const past = await PastPaperQuestion.find(q)
      .select("_id topicKey question difficulty skill estimatedTimeSec marks")
      .lean();
    past.forEach((row) => pushUnique("past_paper_question", row._id, row.topicKey, row, toStudentSafePastPaperQuestion));
  }

  const selected = challengeMode ? selectChallengePracticeItems(rawItems, cap) : rawItems.slice(0, cap);

  const setItems = selected.map(({ contentType, contentId, topicKey }) => ({ contentType, contentId, topicKey }));
  const practiceSet = await PracticeSet.create({
    studentId,
    teacherId,
    specKey,
    topicKeys: topicKeysTrimmed,
    items: setItems,
  });

  const serializerOpts = { challengeMode };
  const studentSafeItems = selected.map(({ row, serializer }) => serializer(row, serializerOpts));
  return { practiceSetId: practiceSet._id, items: studentSafeItems, mode: challengeMode ? "challenge" : "standard" };
}

module.exports = {
  generatePracticeSet,
  generateAndPersistPracticeSet,
  OUTCOME_ENUM,
  CONTENT_TYPES,
  isStrongChallengeQuestion,
  challengeRankScore,
  selectChallengePracticeItems,
};
