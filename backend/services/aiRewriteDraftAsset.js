/**
 * Item-level LLM rewrites for draft topic-bank assets only. JSON in/out; validate before save; never publish.
 */
const Lesson = require("../models/Lesson");
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const { fingerprint: flashFp } = require("../utils/flashcardDedupe");
const { fingerprint: quizFp } = require("../utils/quizDedupe");
const { examQuestionFingerprint } = require("../utils/examQuestionDedupe");
const {
  validateFlashcardDraft,
  validateQuizMcqDraft,
  validateExamQuestionDraft,
} = require("../schemas/lessonAssetDrafts");
const {
  scoreFlashcardDraft,
  scoreQuizMcqDraft,
  scoreExamDraft,
  metadataQualityPatch,
} = require("../utils/draftQualityScoring");

const FLASHCARD_ACTIONS = new Set(["simplify_answer", "shorten_answer", "improve_recall_prompt"]);
const QUIZ_MCQ_ACTIONS = new Set([
  "improve_distractors",
  "make_easier",
  "make_harder",
  "improve_explanation",
  "reword_question",
]);
const EXAM_ACTIONS = new Set([
  "improve_mark_scheme",
  "make_more_gcse_style",
  "make_easier",
  "make_harder",
]);

async function loadLessonSnippet(lessonId) {
  if (!lessonId || !String(lessonId).trim()) return null;
  try {
    return await Lesson.findById(lessonId)
      .select("title description topic topicKey pages content")
      .lean();
  } catch {
    return null;
  }
}

function lessonContextBlock(lesson) {
  if (!lesson) return "";
  const parts = [];
  if (lesson.title) parts.push(`Title: ${lesson.title}`);
  if (lesson.topic) parts.push(`Topic label: ${lesson.topic}`);
  const desc = lesson.description && String(lesson.description).trim().slice(0, 500);
  if (desc) parts.push(`Description (excerpt): ${desc}`);
  return parts.join("\n");
}

function specAndTopicFromStoredKey(storedTopicKey) {
  const raw = String(storedTopicKey || "");
  const specKey = raw.includes(":") ? raw.split(":")[0] : "";
  return { specKey, namespacedTopicKey: raw };
}

/**
 * @param {import("mongoose").Document} card - TopicFlashcard
 */
async function applyFlashcardAiRewrite(card, action) {
  if (String(card.status) !== "draft") {
    const e = new Error("AI rewrite is only available for drafts");
    e.statusCode = 400;
    throw e;
  }
  if (!FLASHCARD_ACTIONS.has(action)) {
    const e = new Error(`Invalid action. Allowed: ${[...FLASHCARD_ACTIONS].join(", ")}`);
    e.statusCode = 400;
    throw e;
  }
  const { specKey, namespacedTopicKey } = specAndTopicFromStoredKey(card.topicKey);
  if (!specKey || !namespacedTopicKey) {
    const e = new Error("Invalid topicKey on card");
    e.statusCode = 400;
    throw e;
  }
  const lesson = await loadLessonSnippet(card.metadata?.lessonId);
  const system = `You improve UK GCSE revision flashcards. Reply with ONLY a JSON object: {"front":"string","back":"string"}.
Rules: British English; front is the prompt (concise); back is the answer; front max 500 chars, back max 2000; no markdown fences; stay on-topic for the given topic/subtopic.`;
  const user = `${lessonContextBlock(lesson)}
Action: ${action}
Subtopic: ${card.topic || ""}
Current front: ${card.front}
Current back: ${card.back}`;
  const out = await callOpenAiJson({ system, user, temperature: 0.25 });
  const draft = {
    front: String(out.front ?? "").trim(),
    back: String(out.back ?? "").trim(),
  };
  const v = validateFlashcardDraft(draft, specKey, namespacedTopicKey, new Set());
  if (!v.ok) {
    const e = new Error(v.errors.join("; "));
    e.statusCode = 400;
    throw e;
  }
  card.front = draft.front.slice(0, 500);
  card.back = draft.back.slice(0, 2000);
  card.fingerprint = flashFp(card.front, card.back);
  card.metadata = {
    ...(card.metadata && typeof card.metadata === "object" ? card.metadata : {}),
    aiReview: { lastRewriteAction: action, lastRewriteAt: new Date().toISOString() },
  };
  await card.save();
  return card;
}

/**
 * @param {import("mongoose").Document} doc - TopicQuizQuestion (MCQ)
 */
async function applyQuizMcqAiRewrite(doc, action) {
  if (String(doc.status) !== "draft") {
    const e = new Error("AI rewrite is only available for drafts");
    e.statusCode = 400;
    throw e;
  }
  const qType = String(doc.type || "mcq").toLowerCase();
  if (qType === "short-answer") {
    const e = new Error("AI rewrite for quiz bank supports MCQ drafts only in this version");
    e.statusCode = 400;
    throw e;
  }
  if (!QUIZ_MCQ_ACTIONS.has(action)) {
    const e = new Error(`Invalid action. Allowed: ${[...QUIZ_MCQ_ACTIONS].join(", ")}`);
    e.statusCode = 400;
    throw e;
  }
  const { specKey, namespacedTopicKey } = specAndTopicFromStoredKey(doc.topicKey);
  if (!specKey || !namespacedTopicKey) {
    const e = new Error("Invalid topicKey on question");
    e.statusCode = 400;
    throw e;
  }
  const lesson = await loadLessonSnippet(doc.metadata?.lessonId);
  const choices = Array.isArray(doc.choices) ? [...doc.choices] : [];
  while (choices.length < 4) choices.push("");
  const system = `You improve UK GCSE multiple-choice bank questions. Reply with ONLY JSON:
{"questionText":"string","choices":["A","B","C","D"],"correctIndex":0,"explanation":"string"}
Rules: exactly 4 choices; correctIndex 0-3; explanation clear and teaching-focused; British English; no markdown.`;
  const user = `${lessonContextBlock(lesson)}
Action: ${action}
Current question: ${doc.questionText}
Choices: ${JSON.stringify(choices.slice(0, 4))}
Correct index: ${doc.correctIndex}
Explanation: ${doc.explanation || ""}`;
  const out = await callOpenAiJson({ system, user, temperature: 0.25 });
  const rawChoices = Array.isArray(out.choices) ? out.choices.map((c) => String(c ?? "").trim()) : [];
  while (rawChoices.length < 4) rawChoices.push("");
  const draft = {
    questionText: String(out.questionText ?? "").trim(),
    choices: rawChoices.slice(0, 4),
    correctIndex: Math.min(3, Math.max(0, Number(out.correctIndex) || 0)),
    explanation: String(out.explanation ?? "").trim(),
  };
  const v = validateQuizMcqDraft(draft, specKey, namespacedTopicKey, new Set());
  if (!v.ok) {
    const e = new Error(v.errors.join("; "));
    e.statusCode = 400;
    throw e;
  }
  doc.questionText = draft.questionText;
  doc.choices = draft.choices;
  doc.correctIndex = draft.correctIndex;
  doc.explanation = draft.explanation;
  doc.fingerprint = quizFp(doc.questionText, doc.choices, doc.correctIndex, doc.kind || "quiz");
  const scored = scoreQuizMcqDraft({
    questionText: doc.questionText,
    choices: doc.choices,
    explanation: doc.explanation,
    correctIndex: doc.correctIndex,
  });
  doc.metadata = {
    ...(doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {}),
    aiReview: { lastRewriteAction: action, lastRewriteAt: new Date().toISOString() },
    ...metadataQualityPatch(scored, "heuristic"),
  };
  await doc.save();
  return doc;
}

/**
 * @param {import("mongoose").Document} ex - ExamQuestion (mcq or short)
 */
async function applyExamAiRewrite(ex, action) {
  if (String(ex.status) !== "draft") {
    const e = new Error("AI rewrite is only available for drafts");
    e.statusCode = 400;
    throw e;
  }
  if (!["mcq", "short"].includes(String(ex.type))) {
    const e = new Error("AI rewrite supports exam drafts of type mcq or short only");
    e.statusCode = 400;
    throw e;
  }
  if (!EXAM_ACTIONS.has(action)) {
    const e = new Error(`Invalid action. Allowed: ${[...EXAM_ACTIONS].join(", ")}`);
    e.statusCode = 400;
    throw e;
  }
  const { specKey, namespacedTopicKey } = specAndTopicFromStoredKey(ex.topicKey);
  if (!specKey || !namespacedTopicKey) {
    const e = new Error("Invalid topicKey on exam question");
    e.statusCode = 400;
    throw e;
  }
  const lesson = await loadLessonSnippet(ex.metadata?.lessonId);
  const isMcq = ex.type === "mcq";
  const system = isMcq
    ? `You improve UK GCSE exam-style questions. Reply with ONLY JSON:
{"question":"string","marks":number,"options":["","","",""],"correctIndex":0,"markScheme":["bullet"],"modelAnswer":"string"}
Rules: markScheme is 1+ marking bullets; modelAnswer summary; exactly 4 options for MCQ; marks 1-9; British English.`
    : `You improve UK GCSE exam-style short answers. Reply with ONLY JSON:
{"question":"string","marks":number,"markScheme":["bullet1"],"modelAnswer":"string"}
Rules: markScheme lines are marking points; modelAnswer is a concise exemplar; marks 1-9; British English.`;

  const user = `${lessonContextBlock(lesson)}
Action: ${action}
Subject: ${ex.subject || ""} Level: ${ex.level || ""}
Type: ${ex.type}
Marks: ${ex.marks}
Question: ${ex.question}
Mark scheme: ${JSON.stringify(ex.markScheme || [])}
Model answer: ${ex.metadata?.modelAnswer || ex.correctAnswer || ""}
Options: ${JSON.stringify(ex.options || [])}
CorrectIndex: ${ex.correctIndex}`;
  const out = await callOpenAiJson({ system, user, temperature: 0.25 });
  const marks = Math.min(9, Math.max(1, Number(out.marks) || ex.marks));
  const question = String(out.question ?? "").trim();
  let markScheme = Array.isArray(out.markScheme) ? out.markScheme.map((l) => String(l || "").trim()).filter(Boolean) : [];
  let modelAnswer = String(out.modelAnswer ?? "").trim();
  if (!markScheme.length && modelAnswer) markScheme = [modelAnswer];
  if (!modelAnswer && markScheme.length) modelAnswer = markScheme.join(" ").slice(0, 500);

  let options = [];
  let correctIndex = 0;
  if (isMcq) {
    options = Array.isArray(out.options) ? out.options.map((o) => String(o || "").trim()) : [];
    while (options.length < 2) options.push("");
    options = options.slice(0, 6);
    correctIndex = Math.min(Math.max(0, Number(out.correctIndex) || 0), options.length - 1);
  }

  const forValidate = {
    type: ex.type,
    marks,
    question,
    markScheme,
    modelAnswer,
    options: isMcq ? options : [],
    correctIndex: isMcq ? correctIndex : null,
  };
  const v = validateExamQuestionDraft(forValidate, specKey, namespacedTopicKey, new Set());
  if (!v.ok) {
    const e = new Error(v.errors.join("; "));
    e.statusCode = 400;
    throw e;
  }
  ex.question = question;
  ex.marks = marks;
  ex.markScheme = markScheme;
  if (isMcq) {
    ex.options = options;
    ex.correctIndex = correctIndex;
    ex.correctAnswer = null;
  } else {
    ex.correctAnswer = modelAnswer;
    ex.options = [];
    ex.correctIndex = null;
  }
  const msStr = [...(ex.markScheme || []), ex.correctAnswer || "", modelAnswer].filter(Boolean).join("\n");
  ex.fingerprint = examQuestionFingerprint({
    specKey,
    topicKey: namespacedTopicKey,
    question: ex.question,
    markScheme: msStr,
    marks: ex.marks,
  });
  const scored = scoreExamDraft({
    question: ex.question,
    marks: ex.marks,
    markScheme: ex.markScheme,
    type: ex.type,
    modelAnswer,
    correctAnswer: ex.correctAnswer,
  });
  ex.metadata = {
    ...(ex.metadata && typeof ex.metadata === "object" ? ex.metadata : {}),
    modelAnswer,
    aiReview: { lastRewriteAction: action, lastRewriteAt: new Date().toISOString() },
    ...metadataQualityPatch(scored, "heuristic"),
  };
  await ex.save();
  return ex;
}

module.exports = {
  FLASHCARD_ACTIONS,
  QUIZ_MCQ_ACTIONS,
  EXAM_ACTIONS,
  applyFlashcardAiRewrite,
  applyQuizMcqAiRewrite,
  applyExamAiRewrite,
};
