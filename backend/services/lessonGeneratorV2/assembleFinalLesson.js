/**
 * Assemble V2 Phase 1–3 staged output into an in-memory Lesson-shaped draft.
 * Does NOT persist to MongoDB. Phase 3 is the only source of activity questions.
 */

const { STAGE_STATUS } = require("./schemas");

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

function mapQuestionForBlock(q, index, prefix) {
  const prompt = String(q?.prompt || q?.question || "").trim();
  const questionType = String(q?.questionType || q?.type || "short").toLowerCase() === "mcq" ? "mcq" : "short";
  const options = Array.isArray(q?.options) ? q.options.map((o) => String(o || "").trim()).filter(Boolean) : [];
  const purpose = String(q?.purpose || "").trim().toLowerCase();
  return {
    id: String(q?.id || `${prefix}${index + 1}`),
    prompt,
    question: prompt,
    questionType,
    type: questionType,
    options: questionType === "mcq" ? options : [],
    correctAnswer: String(q?.correctAnswer || "").trim(),
    purpose: purpose || undefined,
    marks: Number(q?.marks) > 0 ? Number(q.marks) : 1,
    tags: purpose ? [`purpose:${purpose}`] : [],
  };
}

/** Legacy single-field mirror of questions[0] for older editor / sanitizer paths. */
function legacyFieldsFromQuestions(mappedQuestions) {
  const first = Array.isArray(mappedQuestions) && mappedQuestions.length ? mappedQuestions[0] : null;
  if (!first) {
    return {
      prompt: "",
      question: "",
      questionType: "short",
      options: [],
      correctAnswer: "",
    };
  }
  return {
    prompt: first.prompt || first.question || "",
    question: first.question || first.prompt || "",
    questionType: first.questionType || first.type || "short",
    options: Array.isArray(first.options) ? first.options : [],
    correctAnswer: first.correctAnswer || "",
  };
}

function mapQuestionForQuiz(q, index) {
  const mapped = mapQuestionForBlock(q, index, "qz");
  return {
    id: mapped.id,
    type: mapped.type === "mcq" ? "mcq" : "short",
    question: mapped.question,
    options: mapped.type === "mcq" ? mapped.options : undefined,
    correctAnswer: mapped.correctAnswer,
    marks: mapped.marks,
    tags: mapped.tags,
    purpose: mapped.purpose,
  };
}

/**
 * @param {object} staged
 * @param {{ teacherId?: string, teacherName?: string }} [authCtx]
 * @returns {{ ok: boolean, finalLesson: object|null, issues: string[] }}
 */
function assembleFinalLesson(staged, authCtx = {}) {
  const issues = [];
  const phase1 = staged?.phase1Lesson || {};
  const phase2 = staged?.phase2VisualActivities || {};
  const phase3 = staged?.phase3Questions || {};
  const meta = staged?.meta || {};

  if (phase1.status !== STAGE_STATUS.COMPLETE) issues.push("assemble_phase1_incomplete");
  if (phase2.status !== STAGE_STATUS.COMPLETE) issues.push("assemble_phase2_incomplete");
  if (phase3.status !== STAGE_STATUS.COMPLETE) issues.push("assemble_phase3_incomplete");
  if (phase2.studentSafe !== true) issues.push("assemble_phase2_not_student_safe");

  const selfCheck = Array.isArray(phase3.selfCheck) ? phase3.selfCheck : [];
  const checkpoint = Array.isArray(phase3.checkpoint) ? phase3.checkpoint : [];
  const quiz = Array.isArray(phase3.quiz) ? phase3.quiz : [];
  if (selfCheck.length !== 3) issues.push("assemble_selfCheck_not_3");
  if (checkpoint.length !== 3) issues.push("assemble_checkpoint_not_3");
  if (quiz.length !== 5) issues.push("assemble_quiz_not_5");

  if (issues.length) {
    return { ok: false, finalLesson: null, issues };
  }

  const topic = String(phase1.topic || meta.topic || "").trim();
  const subject = String(phase1.subject || meta.subject || "").trim();
  const level = String(phase1.level || meta.level || "").trim();
  const board = String(phase1.board || phase1.examBoard || meta.board || "").trim();
  const tier = String(phase1.tier || meta.tier || "").trim();
  const topicKey = String(phase1.topicKey || meta.topicKey || "").trim();
  const specKey = String(phase1.specKey || meta.specKey || "").trim();
  const title = String(phase1.title || `${topic} (${board || "GCSE"} ${level})`).trim();

  const objectives = Array.isArray(phase1.objectives) ? phase1.objectives.filter((o) => nonEmpty(o, 8)) : [];
  const sections = Array.isArray(phase1.sections) ? phase1.sections : [];
  const keyTerms = Array.isArray(phase1.keyTerms) ? phase1.keyTerms.filter((t) => nonEmpty(String(t), 2)) : [];
  const misconceptions = Array.isArray(phase1.misconceptions) ? phase1.misconceptions : [];
  const examTips = Array.isArray(phase1.examTips) ? phase1.examTips.filter((t) => nonEmpty(t, 8)) : [];
  const summary = String(phase1.summary || "").trim();
  const priorKnowledge = String(phase1.priorKnowledge || "").trim();

  if (objectives.length < 1 && sections.length < 1) {
    issues.push("assemble_teaching_empty");
    return { ok: false, finalLesson: null, issues };
  }

  const blocks = [];

  if (objectives.length) {
    blocks.push({
      type: "keyIdea",
      role: "objectives",
      content: objectives.map((o, i) => `${i + 1}. ${o}`).join("\n"),
    });
  }

  if (priorKnowledge) {
    blocks.push({
      type: "text",
      role: "priorKnowledge",
      content: `**Prior knowledge**\n\n${priorKnowledge}`,
    });
  }

  for (const section of sections) {
    const body = String(section?.content || "").trim();
    if (!body) continue;
    blocks.push({
      type: "text",
      role: String(section?.id || "section"),
      content: `**${String(section?.title || section?.id || "Teaching").trim()}**\n\n${body}`,
    });
  }

  if (keyTerms.length) {
    blocks.push({
      type: "keyWords",
      role: "keyTerms",
      content: keyTerms.join(", "),
    });
  }

  for (const m of misconceptions) {
    const wrong = String(m?.wrong || "").trim();
    const correct = String(m?.correct || "").trim();
    if (!wrong && !correct) continue;
    blocks.push({
      type: "commonMistake",
      role: "misconception",
      content: `Incorrect: ${wrong}\n\nCorrect: ${correct}`,
    });
  }

  for (const tip of examTips) {
    blocks.push({
      type: "examTip",
      role: "examTip",
      content: tip,
    });
  }

  if (summary) {
    blocks.push({
      type: "text",
      role: "summary",
      content: `**Summary**\n\n${summary}`,
    });
  }

  const teachingDiagrams = Array.isArray(phase2.teachingDiagrams) ? phase2.teachingDiagrams : [];
  for (const d of teachingDiagrams) {
    blocks.push({
      type: "diagram",
      role: "teachingDiagram",
      title: String(d?.title || "Teaching diagram").trim(),
      caption: String(d?.prompt || "").trim(),
      note: Array.isArray(d?.whatToNotice) ? d.whatToNotice.filter((w) => nonEmpty(w, 4)).join(" | ") : undefined,
      source: "v2_prompt_only",
      labelsAllowed: d?.labelsAllowed === true,
      // No visualId / imageUrl yet — prompt metadata only for PR A.
      v2ImagePrompt: String(d?.prompt || "").trim(),
      derivedFromSectionIds: Array.isArray(d?.derivedFromSectionIds) ? d.derivedFromSectionIds : [],
    });
  }

  const retrievalActivities = Array.isArray(phase2.retrievalActivities) ? phase2.retrievalActivities : [];
  for (const a of retrievalActivities) {
    blocks.push({
      type: "text",
      role: "retrievalActivity",
      content: [
        `**${String(a?.title || "Retrieval activity").trim()}**`,
        String(a?.studentTask || "").trim(),
        "Student image must remain unlabelled — answers stay in the teacher brief only.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      // Student-facing prompt metadata only (validator re-checks safety).
      v2StudentFacingImagePrompt: String(a?.studentFacingImagePrompt || "").trim(),
      v2TeacherFacingBrief: String(a?.teacherFacingBrief || "").trim(),
      labelsAllowedOnStudentImage: false,
      studentSafe: a?.studentSafe !== false,
      bannedRevealTerms: Array.isArray(a?.bannedRevealTerms) ? a.bannedRevealTerms : [],
    });
  }

  const scMapped = selfCheck.map((q, i) => mapQuestionForBlock(q, i, "sc"));
  const scLegacy = legacyFieldsFromQuestions(scMapped);
  blocks.push({
    type: "selfCheck",
    role: "selfCheck",
    prompt: scLegacy.prompt,
    question: scLegacy.question,
    questionType: scLegacy.questionType,
    options: scLegacy.questionType === "mcq" ? scLegacy.options : [],
    correctAnswer: scLegacy.correctAnswer,
    questions: scMapped,
  });

  const cpMapped = checkpoint.map((q, i) => mapQuestionForBlock(q, i, "cp"));
  const cpLegacy = legacyFieldsFromQuestions(cpMapped);
  blocks.push({
    type: "checkpoint",
    role: "checkpoint",
    prompt: cpLegacy.prompt,
    question: cpLegacy.question,
    questionType: cpLegacy.questionType,
    options: cpLegacy.questionType === "mcq" ? cpLegacy.options : [],
    correctAnswer: cpLegacy.correctAnswer,
    questions: cpMapped,
  });

  const quizMapped = quiz.map((q, i) => mapQuestionForQuiz(q, i));
  const quizLegacy = legacyFieldsFromQuestions(
    quizMapped.map((q) => ({
      ...q,
      prompt: q.question || q.prompt,
      questionType: q.type,
    }))
  );
  blocks.push({
    type: "pageQuiz",
    role: "pageQuiz",
    prompt: quizLegacy.prompt,
    question: quizLegacy.question,
    questionType: quizLegacy.questionType,
    options: quizLegacy.questionType === "mcq" ? quizLegacy.options : [],
    correctAnswer: quizLegacy.correctAnswer,
    questions: quizMapped,
  });

  const teachingBlockCount = blocks.filter((b) =>
    ["text", "keyIdea", "keyWords", "examTip", "commonMistake"].includes(b.type)
  ).length;
  if (teachingBlockCount < 1) {
    issues.push("assemble_no_teaching_blocks");
    return { ok: false, finalLesson: null, issues };
  }

  const description =
    objectives[0] ||
    summary.slice(0, 180) ||
    `Draft ${subject} lesson on ${topic} generated by Lesson Generator V2.`;

  const contentParts = [
    priorKnowledge,
    ...sections.map((s) => String(s?.content || "").trim()),
    summary,
  ].filter(Boolean);
  const content = contentParts.join("\n\n").slice(0, 8000) || description;

  const pageId = "v2-page-1";
  const finalLesson = {
    title,
    description,
    content,
    subject,
    level,
    topic,
    board: board || undefined,
    examBoardName: board || undefined,
    tier: tier || undefined,
    topicKey: topicKey || undefined,
    specKey: specKey || undefined,
    teacherId: authCtx.teacherId || undefined,
    teacherName: authCtx.teacherName || undefined,
    status: "draft",
    isPublished: false,
    pipeline: "lesson-generator-v2",
    pages: [
      {
        pageId,
        title: title,
        blocks,
      },
    ],
    quiz: {
      questions: quizMapped.map((q) => ({
        ...q,
        pageId,
      })),
    },
    metadata: {
      generator: "v2",
      pipeline: "lesson-generator-v2",
      assembledAt: new Date().toISOString(),
      v2VisualPlan: {
        teachingDiagrams,
        retrievalActivities,
        studentSafe: true,
      },
      v2Phase3Source: {
        selfCheckCount: selfCheck.length,
        checkpointCount: checkpoint.length,
        quizCount: quiz.length,
      },
      persistence: {
        implemented: false,
        saved: false,
      },
    },
  };

  return { ok: true, finalLesson, issues: [] };
}

module.exports = {
  assembleFinalLesson,
  mapQuestionForBlock,
  mapQuestionForQuiz,
};
