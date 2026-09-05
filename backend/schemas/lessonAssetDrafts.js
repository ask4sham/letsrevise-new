/**
 * Strict validation for AI-generated lesson assets before DB save.
 * No new runtime dependency — plain checks.
 */

const { parseTopicKey } = require("../utils/topicKey");
const { assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");
const { normalizeNamespacedLessonTopicKey } = require("../utils/normalizeLessonTopicKey");
const { validateShortMarksMarkSchemeInvariant } = require("../../lib/block28PracticePolicy");

function isNonEmptyString(s, minLen = 1) {
  return typeof s === "string" && s.trim().length >= minLen;
}

/**
 * @param {string} specKey
 * @param {string} namespacedTopicKey
 * @param {Set<string>} validPageIds
 */
function validateFlashcardDraft(item, specKey, namespacedTopicKey, validPageIds) {
  const errs = [];
  if (!isNonEmptyString(item.front, 3)) errs.push("front too short or missing");
  if (!isNonEmptyString(item.back, 3)) errs.push("back too short or missing");
  if (item.front && item.front.length > 500) errs.push("front exceeds 500 chars");
  if (item.back && item.back.length > 2000) errs.push("back exceeds 2000 chars");
  try {
    assertValidNamespacedTopicKey(specKey, namespacedTopicKey);
  } catch (e) {
    errs.push(e.message || "invalid topic");
  }
  if (item.pageId != null && item.pageId !== "") {
    const pid = String(item.pageId);
    if (validPageIds.size && !validPageIds.has(pid)) errs.push("pageId not on lesson");
  }
  return errs.length ? { ok: false, errors: errs } : { ok: true };
}

function validateQuizMcqDraft(item, specKey, namespacedTopicKey, validPageIds) {
  const errs = [];
  if (!isNonEmptyString(item.questionText, 5)) errs.push("questionText too short");
  if (!Array.isArray(item.choices) || item.choices.length < 2) errs.push("need at least 2 choices");
  const ci = Number(item.correctIndex);
  if (!Number.isFinite(ci) || ci < 0 || ci >= (item.choices || []).length) errs.push("invalid correctIndex");
  if (!isNonEmptyString(item.explanation, 3)) errs.push("explanation too short");
  try {
    assertValidNamespacedTopicKey(specKey, namespacedTopicKey);
  } catch (e) {
    errs.push(e.message || "invalid topic");
  }
  if (item.pageId != null && item.pageId !== "") {
    const pid = String(item.pageId);
    if (validPageIds.size && !validPageIds.has(pid)) errs.push("pageId not on lesson");
  }
  return errs.length ? { ok: false, errors: errs } : { ok: true };
}

function validateExamQuestionDraft(item, specKey, namespacedTopicKey, validPageIds) {
  const errs = [];
  if (!isNonEmptyString(item.question, 5)) errs.push("question too short");
  if (!["mcq", "short"].includes(String(item.type || "mcq"))) errs.push("type must be mcq or short for phase 1");
  const marks = Number(item.marks);
  if (!Number.isFinite(marks) || marks < 1 || marks > 9) errs.push("marks must be 1–9");
  const msOk =
    Array.isArray(item.markScheme) &&
    item.markScheme.length >= 1 &&
    item.markScheme.every((l) => isNonEmptyString(String(l), 2));
  const modelOk = isNonEmptyString(item.modelAnswer, 5);
  if (!msOk && !modelOk) errs.push("markScheme or modelAnswer required");
  if (Array.isArray(item.markScheme) && item.markScheme.length && !item.markScheme.every((l) => isNonEmptyString(String(l), 2))) {
    errs.push("markScheme lines too short");
  }
  if (item.type === "mcq") {
    if (!Array.isArray(item.options) || item.options.length < 2) errs.push("mcq needs options");
    const ci = Number(item.correctIndex);
    if (!Number.isFinite(ci) || ci < 0 || ci >= (item.options || []).length) errs.push("invalid correctIndex for mcq");
  }
  try {
    assertValidNamespacedTopicKey(specKey, namespacedTopicKey);
  } catch (e) {
    errs.push(e.message || "invalid topic");
  }
  if (item.pageId != null && item.pageId !== "") {
    const pid = String(item.pageId);
    if (validPageIds.size && !validPageIds.has(pid)) errs.push("pageId not on lesson");
  }
  return errs.length ? { ok: false, errors: errs } : { ok: true };
}

/** AI “Generate exam drafts” only: structured short answers, not quiz-style MCQs (use Topic Quiz Bank for MCQs). */
const EXAM_STYLE_COMMAND_RE = /^(explain|describe|compare|evaluate|outline|suggest|justify|calculate|how|why)\b/i;

function validateExamQuestionDraftForAiLessonBank(item, specKey, namespacedTopicKey, validPageIds) {
  const errs = [];
  const t = String(item.type || "").toLowerCase();
  if (t !== "short") {
    errs.push('AI exam drafts must be type "short" (exam-style). Use Generate AI assets → quiz for MCQs.');
  }
  const marks = Number(item.marks);
  if (!Number.isFinite(marks) || marks < 2 || marks > 6) {
    errs.push("exam-style AI drafts use 2–6 marks (GCSE-style short responses)");
  }
  if (!isNonEmptyString(item.question, 25)) errs.push("question stem too short for exam-style prompt");
  const cmd = String(item.commandWord || "").trim();
  const stemOk = EXAM_STYLE_COMMAND_RE.test(String(item.question || "").trim());
  if (!cmd && !stemOk) {
    errs.push("use a command word (Explain, Describe, Compare, …) in the stem or commandWord field");
  }
  const ms = Array.isArray(item.markScheme) ? item.markScheme.map((x) => String(x || "").trim()) : [];
  const substantial = ms.filter((l) => l.length >= 10);
  if (substantial.length < 2) errs.push("markScheme needs at least two substantive points (~10+ chars each)");
  const schemeCheck = validateShortMarksMarkSchemeInvariant(marks, ms);
  if (!schemeCheck.ok) errs.push(schemeCheck.msg);
  if (!isNonEmptyString(item.modelAnswer, 25)) errs.push("modelAnswer too short for an exam-style response");
  try {
    assertValidNamespacedTopicKey(specKey, namespacedTopicKey);
  } catch (e) {
    errs.push(e.message || "invalid topic");
  }
  if (item.pageId != null && item.pageId !== "") {
    const pid = String(item.pageId);
    if (validPageIds.size && !validPageIds.has(pid)) errs.push("pageId not on lesson");
  }
  return errs.length ? { ok: false, errors: errs } : { ok: true };
}

/**
 * Build namespaced topic key from lesson fields.
 */
function namespacedTopicKeyFromLesson(lesson) {
  const raw = (lesson.topicKey && String(lesson.topicKey).trim()) || "";
  const parsed = raw ? parseTopicKey(raw) : { specKey: "", topicKey: "" };
  const spec =
    (lesson.specKey && String(lesson.specKey).trim()) ||
    (parsed.specKey && String(parsed.specKey).trim()) ||
    "";
  if (!spec) return { error: "Lesson has no specKey" };
  const namespaced = normalizeNamespacedLessonTopicKey(spec, {
    topicKey: lesson.topicKey,
    canonicalTopicKey: lesson.canonicalTopicKey,
    title: lesson.title,
    topic: lesson.topic,
    subTopic: lesson.subTopic,
  });
  if (namespaced) return { namespacedTopicKey: namespaced, specKey: spec };
  if (!raw) return { error: "Lesson has no topicKey — set Topic to a syllabus sub-topic (e.g. Respiration) and save." };
  return {
    error:
      "Lesson topicKey is not mapped to a valid syllabus sub-topic. Set Topic to match taxonomy (e.g. Respiration) and save, or use Rebuild Graph.",
  };
}

module.exports = {
  validateFlashcardDraft,
  validateQuizMcqDraft,
  validateExamQuestionDraft,
  validateExamQuestionDraftForAiLessonBank,
  namespacedTopicKeyFromLesson,
};
