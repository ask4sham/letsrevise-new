"use strict";

/**
 * Adapt a PR10-compatible Synthesiser draft into a Lesson create document.
 * Always forces draft / unpublished. Does not call publish logic.
 */

function asString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value);
}

function adaptQuestion(q) {
  if (!q || typeof q !== "object") return q;
  const answer = q.answer != null ? q.answer : q.correctAnswer;
  const correctAnswer = q.correctAnswer != null ? q.correctAnswer : q.answer;
  const markScheme = Array.isArray(q.markScheme) ? [...q.markScheme] : [];
  const sourceIds = Array.isArray(q.sourceIds) ? [...q.sourceIds] : [];
  const metadata = {
    ...(q.metadata && typeof q.metadata === "object" ? q.metadata : {}),
  };
  if (sourceIds.length && !metadata.sourceIds) {
    metadata.sourceIds = sourceIds;
  }
  if (markScheme.length && !metadata.markScheme) {
    metadata.markScheme = markScheme;
  }

  return {
    ...q,
    question: asString(q.question || q.prompt || q.stem),
    prompt: asString(q.prompt || q.stem || q.question),
    stem: asString(q.stem || q.prompt || q.question),
    answer,
    correctAnswer,
    markScheme,
    sourceIds,
    options: Array.isArray(q.options) ? [...q.options] : q.options,
    metadata: Object.keys(metadata).length ? metadata : q.metadata,
  };
}

function adaptQuizQuestion(q, pageId) {
  const adapted = adaptQuestion(q);
  const type = adapted.type === "mcq" || adapted.type === "exam" ? adapted.type : "short";
  return {
    id: asString(adapted.id || `q-${Date.now()}`),
    type,
    question: asString(adapted.question),
    options: Array.isArray(adapted.options) && adapted.options.length
      ? adapted.options.map(String)
      : undefined,
    correctAnswer: asString(adapted.correctAnswer ?? adapted.answer ?? ""),
    markScheme: Array.isArray(adapted.markScheme) ? adapted.markScheme.map(String) : undefined,
    explanation: asString(adapted.explanation || ""),
    purpose: adapted.purpose,
    tags: Array.isArray(adapted.tags) ? adapted.tags : [],
    difficulty: typeof adapted.difficulty === "number" ? adapted.difficulty : 1,
    marks: typeof adapted.marks === "number" ? adapted.marks : 1,
    pageId: pageId || adapted.pageId,
    // Preserve provenance outside strict quiz schema via nested metadata on Mixed... 
    // Quiz subdocs strip unknown keys; keep markScheme/correctAnswer which schema allows.
  };
}

function adaptBlock(block) {
  if (!block || typeof block !== "object") return block;
  const type = block.type;
  const out = {
    type,
    content: asString(block.content),
    title: block.title != null ? asString(block.title) : undefined,
    role: block.role != null ? asString(block.role) : undefined,
    prompt: block.prompt != null ? asString(block.prompt) : undefined,
    question: block.question != null ? asString(block.question) : undefined,
    questionType: block.questionType,
    options: Array.isArray(block.options) ? [...block.options] : undefined,
    correctAnswer: block.correctAnswer,
    explanation: block.explanation,
    caption: block.caption != null ? asString(block.caption) : undefined,
    subtitle: block.subtitle,
    intro: block.intro != null ? asString(block.intro) : undefined,
    instructions:
      block.instructions != null ? asString(block.instructions) : undefined,
    // Map studentPrompt onto studentTask (schema-supported student-facing field).
    studentTask:
      block.studentTask != null
        ? asString(block.studentTask)
        : block.studentPrompt != null
          ? asString(block.studentPrompt)
          : undefined,
    imageUrl: block.imageUrl,
    alt: block.alt,
    mode: block.mode,
    annotations: block.annotations,
    steps: block.steps,
    connectors: block.connectors,
    markScheme: block.markScheme,
    number: block.number,
    note: block.note,
    diagramVariant: block.diagramVariant,
    matchMode: block.matchMode,
    dragDropLayout: block.dragDropLayout,
    pairs: Array.isArray(block.pairs) ? block.pairs : undefined,
    dropZones: Array.isArray(block.dropZones) ? block.dropZones : undefined,
    sequenceSteps: Array.isArray(block.sequenceSteps)
      ? block.sequenceSteps
      : undefined,
    hotspots: Array.isArray(block.hotspots) ? block.hotspots : undefined,
    labelsAllowedOnStudentImage: block.labelsAllowedOnStudentImage,
    studentSafe: block.studentSafe,
    sourceIds: Array.isArray(block.sourceIds) ? [...block.sourceIds] : undefined,
    metadata:
      block.metadata && typeof block.metadata === "object"
        ? { ...block.metadata }
        : undefined,
  };

  if (Array.isArray(block.questions)) {
    out.questions = block.questions.map(adaptQuestion);
  }

  // Drop undefined keys for cleaner documents.
  Object.keys(out).forEach((k) => {
    if (out[k] === undefined) delete out[k];
  });
  return out;
}

function adaptPage(page, index) {
  const pageId = asString(page?.pageId || `page-${index + 1}`);
  const blocks = Array.isArray(page?.blocks)
    ? page.blocks.map(adaptBlock).filter((b) => b && ALLOWED.has(b.type))
    : [];

  return {
    pageId,
    title: asString(page?.title),
    order: typeof page?.order === "number" ? page.order : index + 1,
    pageType: asString(page?.pageType || ""),
    blocks,
    metadata: page?.metadata,
  };
}

const ALLOWED = new Set([
  "text",
  "keyIdea",
  "keyWords",
  "examTip",
  "commonMistake",
  "checkpoint",
  "selfCheck",
  "pageQuiz",
  "diagram",
  "dragDropMatch",
  "interactiveSequence",
  "interactiveDiagram",
]);

/**
 * @param {object} draft
 * @param {{ ownerTeacherId: string|import('mongoose').Types.ObjectId, teacherName?: string }} options
 */
function adaptSynthesiserDraftToLessonCreate(draft, options = {}) {
  if (!draft || typeof draft !== "object") {
    throw new Error("adaptSynthesiserDraftToLessonCreate requires a draft object");
  }
  if (!options.ownerTeacherId) {
    throw new Error("adaptSynthesiserDraftToLessonCreate requires options.ownerTeacherId");
  }

  const pages = Array.isArray(draft.pages)
    ? draft.pages.map((p, i) => adaptPage(p, i))
    : [];

  const pageQuizBlock = pages
    .flatMap((p) => (p.blocks || []).map((b) => ({ b, pageId: p.pageId })))
    .find(({ b }) => b.type === "pageQuiz");

  let quizQuestions = [];
  if (Array.isArray(draft.quiz?.questions) && draft.quiz.questions.length) {
    quizQuestions = draft.quiz.questions.map((q) =>
      adaptQuizQuestion(q, pageQuizBlock?.pageId)
    );
  } else if (pageQuizBlock?.b?.questions?.length) {
    quizQuestions = pageQuizBlock.b.questions.map((q) =>
      adaptQuizQuestion(q, pageQuizBlock.pageId)
    );
  }

  const incomingMeta =
    draft.metadata && typeof draft.metadata === "object" ? { ...draft.metadata } : {};

  const metadata = {
    ...incomingMeta,
    synthesiser: {
      source: asString(incomingMeta.source || "letsrevise-lesson-synthesiser"),
      generator: asString(incomingMeta.generator || "lesson-synthesiser-v1"),
      schemaVersion: asString(incomingMeta.schemaVersion || ""),
      originalTopicKey: asString(
        incomingMeta.originalTopicKey || ""
      ),
      criticOk: incomingMeta.criticOk === true,
      importedAt: new Date().toISOString(),
    },
  };

  // Prefer metadata.teacherBrief only; never promote into student content.
  if (incomingMeta.teacherBrief != null) {
    metadata.teacherBrief = incomingMeta.teacherBrief;
  }

  const board = asString(draft.board || draft.examBoardName || "");
  const contentFromPages = pages
    .map((p) =>
      (p.blocks || [])
        .map((b) => asString(b.content))
        .filter(Boolean)
        .join("\n")
    )
    .filter(Boolean)
    .join("\n\n");

  return {
    title: asString(draft.title || "Untitled Synthesiser draft"),
    description: asString(draft.description || "Imported Lesson Synthesiser draft."),
    content: asString(draft.content || contentFromPages || " "),
    teacherId: options.ownerTeacherId,
    teacherName: asString(options.teacherName || "Lesson Synthesiser"),
    subject: asString(draft.subject || "Biology"),
    level: asString(draft.level || ""),
    topic: asString(draft.topic || ""),
    specKey: asString(draft.specKey || "") || null,
    topicKey: asString(draft.topicKey || "") || null,
    board,
    tier: draft.tier != null ? asString(draft.tier) : undefined,
    pages,
    quiz: {
      timeSeconds:
        typeof draft.quiz?.timeSeconds === "number" ? draft.quiz.timeSeconds : 600,
      questions: quizQuestions,
    },
    metadata,
    // Server-side draft guarantees (also re-forced in the route before save).
    status: "draft",
    isPublished: false,
  };
}

module.exports = {
  adaptSynthesiserDraftToLessonCreate,
};
