/**
 * v1 lesson-local retrieval: deterministic keyword overlap + phrase + title/topic bonus.
 * No vectors; merges with searchKnowledge results in the enquiry controller.
 */
const mongoose = require("mongoose");
const Lesson = require("../../models/Lesson");

const DEBUG_ENQUIRY = process.env.DEBUG_ENQUIRY === "1" || process.env.DEBUG_ENQUIRY === "true";

const STOP = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "her",
  "was",
  "one",
  "our",
  "out",
  "day",
  "get",
  "has",
  "him",
  "his",
  "how",
  "its",
  "may",
  "new",
  "now",
  "old",
  "see",
  "two",
  "way",
  "who",
  "boy",
  "did",
]);

function normSpec(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function joinMarkScheme(ms) {
  if (ms == null) return "";
  if (Array.isArray(ms)) return ms.filter(Boolean).join("\n");
  return String(ms);
}

function blockTexts(block) {
  const parts = [];
  if (!block || typeof block !== "object") return parts;
  if (block.content) parts.push(String(block.content));
  if (block.prompt) parts.push(String(block.prompt));
  if (block.question) parts.push(String(block.question));
  if (block.explanation) parts.push(String(block.explanation));
  if (block.caption) parts.push(String(block.caption));
  if (block.title) parts.push(String(block.title));
  if (block.note) parts.push(String(block.note));
  if (block.alt) parts.push(String(block.alt));
  if (Array.isArray(block.annotations)) {
    for (const a of block.annotations) {
      if (a && a.text) parts.push(String(a.text));
    }
  }
  return parts.filter(Boolean);
}

function pushSegment(list, text, meta) {
  const t = String(text || "").trim();
  if (!t) return;
  const slice = t.length > 8000 ? `${t.slice(0, 8000)}…` : t;
  list.push({ text: slice, ...meta });
}

/**
 * Flatten lesson document into scored text segments (verified fields only).
 */
function extractLessonSegments(lesson) {
  const segments = [];
  const lessonIdStr = String(lesson._id);

  pushSegment(segments, lesson.title, {
    kind: "title",
    title: lesson.title || "Lesson",
  });
  pushSegment(segments, lesson.description, {
    kind: "description",
    title: "Description",
  });
  pushSegment(segments, lesson.content, {
    kind: "legacyContent",
    title: "Lesson content",
  });

  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  pages.forEach((page, pageIndex) => {
    const pageId = page.pageId != null ? String(page.pageId) : "";
    pushSegment(segments, page.title, {
      kind: "pageTitle",
      pageIndex,
      pageId,
      title: page.title || `Page ${pageIndex + 1}`,
    });
    if (page.checkpoint && page.checkpoint.question) {
      pushSegment(segments, page.checkpoint.question, {
        kind: "pageCheckpoint",
        pageIndex,
        pageId,
        title: "Checkpoint",
      });
    }
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    blocks.forEach((block, blockIndex) => {
      const joined = blockTexts(block).join("\n\n");
      pushSegment(segments, joined, {
        kind: "block",
        pageIndex,
        pageId,
        blockIndex,
        title: block.title || block.type || "Block",
      });
    });
  });

  const flashcards = Array.isArray(lesson.flashcards) ? lesson.flashcards : [];
  flashcards.forEach((fc, i) => {
    const text = [fc.front, fc.back].filter(Boolean).join("\n\n");
    pushSegment(segments, text, {
      kind: "flashcard",
      title: `Flashcard ${i + 1}`,
    });
  });

  const quizQs = lesson.quiz && Array.isArray(lesson.quiz.questions) ? lesson.quiz.questions : [];
  quizQs.forEach((q, i) => {
    const text = [q.question, q.explanation, joinMarkScheme(q.markScheme)].filter(Boolean).join("\n\n");
    pushSegment(segments, text, {
      kind: "quiz",
      title: `Quiz ${i + 1}`,
    });
  });

  const assessQs =
    lesson.assessment && Array.isArray(lesson.assessment.questions) ? lesson.assessment.questions : [];
  assessQs.forEach((q, i) => {
    const text = [q.question, q.explanation, joinMarkScheme(q.markScheme)].filter(Boolean).join("\n\n");
    pushSegment(segments, text, {
      kind: "assessment",
      title: `Assessment ${i + 1}`,
    });
  });

  return { segments, lessonIdStr };
}

function scoreSegment(question, segmentText, { lessonTitle, topicHints }) {
  const qTokens = new Set(tokenize(question));
  const blob = `${segmentText} ${lessonTitle || ""} ${(topicHints || []).join(" ")}`;
  const tTokens = new Set(tokenize(blob));
  if (qTokens.size === 0) return 0.04;

  let overlap = 0;
  for (const q of qTokens) {
    if (tTokens.has(q)) overlap += 1;
  }
  let score = (overlap / qTokens.size) * 0.62;

  const textLower = segmentText.toLowerCase();
  const qCompact = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Direct phrase in this lesson segment (strong signal for in-lesson Q&A).
  if (qCompact.length >= 10) {
    const slice = qCompact.slice(0, 56);
    if (slice.length >= 10 && textLower.includes(slice)) score += 0.18;
  }
  if (qCompact.length >= 24) {
    const slice2 = qCompact.slice(0, 96);
    if (slice2.length >= 24 && textLower.includes(slice2)) score += 0.1;
  }

  const words = question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    if (phrase.length > 5 && textLower.includes(phrase)) score += 0.09;
  }
  let triBonus = 0;
  for (let i = 0; i < words.length - 2; i++) {
    const tri = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    if (tri.length > 8 && textLower.includes(tri)) triBonus += 0.06;
  }
  score += Math.min(0.14, triBonus);

  const titleLower = (lessonTitle || "").toLowerCase();
  let titleBonus = 0;
  for (const q of qTokens) {
    if (titleLower.includes(q)) titleBonus += 0.05;
  }
  score += Math.min(0.12, titleBonus);

  for (const th of topicHints || []) {
    const tl = String(th).toLowerCase();
    let b = 0;
    for (const q of qTokens) {
      if (tl.includes(q)) b += 0.04;
    }
    score += Math.min(0.1, b);
  }

  return Math.min(0.95, score);
}

function canAccessLessonForEnquiry(lesson, user) {
  if (!lesson || !user) return false;
  const role = (user.userType || user.role || "").toString().toLowerCase();
  const isAdmin = role === "admin" || user.isAdmin === true;
  const uid = String(user._id || user.userId || user.id || "");
  const teacherId = String(lesson.teacherId || "");
  if (isAdmin) return true;
  if (teacherId && teacherId === uid) return true;
  if (lesson.status === "archived" || lesson.status === "flagged") return false;
  return lesson.status === "published" || lesson.isPublished === true;
}

/**
 * @param {{ question: string, specKey: string, topicKey?: string|null, lessonId: string, user: object }}
 * @returns {Promise<Array<{ knowledgeDocumentId, sourceType, sourceId, title, text, topicKey, score, metadata }>>}
 */
async function getLessonLocalRetrieval({ question, specKey, topicKey, lessonId, user }) {
  const q = String(question || "").trim();
  const spec = String(specKey || "").trim();
  if (!q || !spec || !lessonId || !mongoose.Types.ObjectId.isValid(lessonId)) return [];

  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) return [];
  if (!canAccessLessonForEnquiry(lesson, user)) return [];

  if (lesson.specKey && spec && normSpec(lesson.specKey) !== normSpec(spec)) return [];

  const reqTopic = (topicKey || "").trim();
  const lesTopic = (lesson.topicKey || "").trim();
  // lessonId is authoritative for which lesson text to use; URL/request topicKey may differ from
  // lesson.topicKey — do not skip lesson-local. Broader retrieval still uses request topicKey in the controller.
  if (
    DEBUG_ENQUIRY &&
    process.env.NODE_ENV !== "test" &&
    reqTopic &&
    lesTopic &&
    reqTopic !== lesTopic
  ) {
    console.log(
      "[lesson_local_topic_mismatch]",
      JSON.stringify({
        lessonId: String(lessonId),
        reqTopic,
        lessonTopicKey: lesTopic,
        lessonLocalProceeds: true,
      })
    );
  }

  const { segments, lessonIdStr } = extractLessonSegments(lesson);
  const lessonTitle = lesson.title || "";
  const topicHints = [lesson.mainTopic, lesson.subTopic, lesson.topic].filter(Boolean);

  const scored = [];
  segments.forEach((seg, idx) => {
    const sc = scoreSegment(q, seg.text, { lessonTitle, topicHints });
    if (sc < 0.008) return;
    scored.push({ seg, idx, sc });
  });

  scored.sort((a, b) => b.sc - a.sc);
  const cap = Math.min(scored.length, 24);
  const top = scored.slice(0, cap);

  const topicKeyOut = lesTopic || reqTopic || "";

  return top.map(({ seg, idx, sc }) => {
    const knowledgeDocumentId = `lessonlocal:${lessonIdStr}:${idx}`;
    const meta = {
      lessonLocal: true,
      segmentKind: seg.kind,
      ...(seg.pageIndex != null && { pageIndex: seg.pageIndex }),
      ...(seg.pageId && { pageId: seg.pageId }),
      ...(seg.blockIndex != null && { blockIndex: seg.blockIndex }),
    };
    return {
      knowledgeDocumentId,
      sourceType: "lessonBlock",
      sourceId: lessonIdStr,
      title: seg.title || lessonTitle || "Lesson",
      text: seg.text,
      topicKey: topicKeyOut,
      score: sc,
      metadata: meta,
    };
  });
}

/**
 * Lesson-local first in merge order; dedupe by knowledgeDocumentId; tie-break prefers lesson-local.
 */
function mergeRetrievalResults(lessonResults, vectorResults, topN) {
  const lessonIds = new Set((lessonResults || []).map((r) => String(r.knowledgeDocumentId)));
  const combined = [...(lessonResults || []), ...(vectorResults || [])];
  const byId = new Map();
  for (const r of combined) {
    const id = String(r.knowledgeDocumentId);
    const prev = byId.get(id);
    if (!prev || (r.score ?? 0) > (prev.score ?? 0)) byId.set(id, r);
  }
  return [...byId.values()]
    .sort((a, b) => {
      const sa = a.score ?? 0;
      const sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      const ia = lessonIds.has(String(a.knowledgeDocumentId)) ? 0 : 1;
      const ib = lessonIds.has(String(b.knowledgeDocumentId)) ? 0 : 1;
      return ia - ib;
    })
    .slice(0, topN);
}

module.exports = {
  getLessonLocalRetrieval,
  mergeRetrievalResults,
};
