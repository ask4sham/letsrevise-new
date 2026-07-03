/**
 * Deterministic Teacher Brain Brief generator (V1 — no AI).
 */

const {
  safeStr,
  isGenericPlaceholder,
  pairsFromBlock,
  pairsAreGeneric,
  collectSurroundingBlocks,
  extractLessonVocabulary,
} = require("./lessonContentExtractor");

function normalizeActivityType(raw) {
  const t = safeStr(raw)
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (t === "dragdropmatch") return "dragDropMatch";
  if (t === "interactivesequence") return "interactiveSequence";
  if (t === "checkpoint" || t === "selfcheck" || t === "selfcheckquestion") return "checkpoint";
  if (t === "examquestion") return "examQuestion";
  if (t === "interactivediagram" || t === "hotspot" || t === "labeldiagram") {
    return "interactiveDiagram";
  }
  return safeStr(raw) || "unknown";
}

function topicLabel(lesson = {}) {
  return (
    safeStr(lesson.subTopic) ||
    safeStr(lesson.topic) ||
    safeStr(lesson.title) ||
    "this topic"
  );
}

function buildPurpose(activityType, lesson, block, vocab) {
  const label = topicLabel(lesson);
  const blockTitle = safeStr(block?.title);
  if (activityType === "dragDropMatch") {
    return (
      blockTitle ||
      `Match structures and functions for ${label} using precise GCSE vocabulary from the lesson.`
    );
  }
  if (activityType === "interactiveSequence") {
    return blockTitle || `Order the key steps in ${label} as taught in this lesson.`;
  }
  if (activityType === "checkpoint") {
    return blockTitle || `Check understanding of ${label} with exam-style reasoning.`;
  }
  if (activityType === "examQuestion") {
    return blockTitle || `Assess ${label} with marks linked to lesson vocabulary.`;
  }
  if (vocab.termDefinitions.length) {
    return `Support ${label} with labels and definitions already introduced nearby.`;
  }
  return `Support GCSE understanding of ${label}.`;
}

function cardsFromVocabulary(vocab, max = 8) {
  const cards = [];
  for (const row of vocab.termDefinitions) {
    cards.push({
      prompt: row.term,
      answer: row.definition,
      explanation: `${row.term} → ${row.definition}`,
    });
    if (cards.length >= max) break;
  }
  return cards;
}

function buildDragDropBrief(block, lesson, vocab, diagram) {
  const existing = pairsFromBlock(block);
  let suggestedCards = [];
  let contentDerived = false;

  if (existing.length && !pairsAreGeneric(existing)) {
    suggestedCards = existing.map((p) => ({
      prompt: p.prompt,
      answer: p.answer,
      explanation: p.explanation || `${p.prompt} → ${p.answer}`,
    }));
    contentDerived = true;
  } else {
    suggestedCards = cardsFromVocabulary(vocab);
    if (suggestedCards.length) contentDerived = true;
  }

  if (!suggestedCards.length && diagram?.hotspots?.length) {
    for (const h of diagram.hotspots) {
      const parts = String(h).split(/\s*[—–-]\s*/);
      const prompt = safeStr(parts[0]);
      const answer = safeStr(parts[1]) || "Match on diagram";
      if (prompt && !isGenericPlaceholder(prompt)) {
        suggestedCards.push({
          prompt,
          answer,
          explanation: parts[1] ? `${prompt} → ${answer}` : `Match: ${prompt}`,
        });
      }
    }
  }

  const assessmentFocus = [];
  if (vocab.vocabulary.length) {
    assessmentFocus.push(`Use precise terms: ${vocab.vocabulary.slice(0, 6).join(", ")}.`);
  }
  assessmentFocus.push("Match structure to function.");
  if (diagram?.assessmentFocus?.length) {
    assessmentFocus.push(...diagram.assessmentFocus);
  }

  return {
    suggestedCards,
    contentDerived,
    assessmentFocus: [...new Set(assessmentFocus)],
    studentTask:
      suggestedCards.length > 1
        ? `Drag each structure card to its matching function for ${topicLabel(lesson)}.`
        : "Drag each card to its correct match using vocabulary from the lesson above.",
  };
}

function buildSequenceBrief(block, lesson, vocab, diagram) {
  const existing = Array.isArray(block?.sequenceSteps) ? block.sequenceSteps : [];
  const steps = [];
  let contentDerived = false;

  if (existing.length) {
    for (const s of existing) {
      const label = safeStr(s?.label || s?.title || s?.text);
      const explanation = safeStr(s?.explanation || s?.description || s?.detail);
      if (label && !isGenericPlaceholder(label)) {
        steps.push({ label, explanation, misconception: safeStr(s?.misconception) });
        contentDerived = true;
      }
    }
  }

  if (!steps.length && vocab.pathways.length) {
    const pathway = vocab.pathways[0];
    pathway.parts.forEach((part, i) => {
      steps.push({
        label: `Step ${i + 1}: ${part}`,
        explanation:
          i === 0
            ? `Process starts at ${part}.`
            : `Follows ${pathway.parts[i - 1]} → ${part}.`,
        misconception: "",
      });
    });
    contentDerived = true;
  }

  if (!steps.length && diagram?.mustShow?.length) {
    diagram.mustShow.forEach((s, i) => {
      const label = safeStr(s);
      if (label) steps.push({ label: `Step ${i + 1}: ${label}`, explanation: "", misconception: "" });
    });
  }

  return {
    suggestedSteps: steps,
    contentDerived,
    assessmentFocus: [
      "Recall step order without hints.",
      `Explain each step in ${topicLabel(lesson)}.`,
    ],
    studentTask: `Put the steps of ${topicLabel(lesson)} in the correct order, then explain each step.`,
  };
}

function buildCheckpointBrief(block, lesson, vocab) {
  const correct = safeStr(block?.correctAnswer);
  const options = Array.isArray(block?.options) ? block.options.map(safeStr).filter(Boolean) : [];
  const distractors = options.filter((o) => o && o !== correct);

  return {
    correctAnswer: correct || "(set from lesson teaching point)",
    distractorRationale: distractors.length
      ? distractors.map((d) => `${d} — confuses related ideas in ${topicLabel(lesson)}.`)
      : ["Add plausible distractors from nearby lesson misconceptions."],
    examinerReason: correct
      ? `Credits precise vocabulary and cause → effect for ${topicLabel(lesson)}.`
      : "Credits the explanation that matches the lesson's key process chain.",
    assessmentFocus: vocab.vocabulary.length
      ? [`Target vocabulary: ${vocab.vocabulary.slice(0, 5).join(", ")}.`]
      : ["One clear AO1/AO2 distinction."],
    studentTask: safeStr(block?.prompt || block?.question) || `Answer the checkpoint for ${topicLabel(lesson)}.`,
  };
}

function buildExamQuestionBrief(block, lesson, vocab) {
  const marks = block?.marks || block?.totalMarks;
  return {
    targetSkill: safeStr(block?.skill) || "Describe and explain using lesson structures and processes.",
    marksLogic: marks
      ? `${marks} marks: 1 mark per correct structure/term; remaining marks for linked explanation.`
      : "Award marks for named structures and linked functions from the lesson.",
    expectedAnswerStructure:
      vocab.termDefinitions.length >= 2
        ? `Point → evidence → link (e.g. ${vocab.termDefinitions
            .slice(0, 2)
            .map((r) => r.term)
            .join(" and ")}).`
        : "Definition → mechanism → exam-linked conclusion.",
    assessmentFocus: [`Use ${topicLabel(lesson)} vocabulary precisely.`],
    studentTask: safeStr(block?.questionText || block?.prompt) || `Exam-style question on ${topicLabel(lesson)}.`,
  };
}

function buildCommonMisconceptions(vocab, brainMisconceptions = []) {
  const fromLesson = vocab.misconceptions.slice(0, 5);
  if (fromLesson.length) return fromLesson;

  const fromBrain = (brainMisconceptions || [])
    .map((m) => safeStr(m.correction || m.misconception))
    .filter((line) => line && !isGenericPlaceholder(line));
  if (fromBrain.length) return fromBrain.slice(0, 4);

  return [];
}

function buildQualityChecks(activityType, briefParts) {
  const checks = [
    "Every card/step uses vocabulary already taught on this page.",
    "No generic placeholder stems.",
  ];
  if (activityType === "dragDropMatch") {
    checks.push("Each prompt has one unambiguous function match.");
    if (!briefParts.suggestedCards?.length) {
      checks.push("Add lesson content before the activity — no structure/function pairs found nearby.");
    }
  }
  if (activityType === "interactiveSequence" && !briefParts.suggestedSteps?.length) {
    checks.push("Add a pathway or numbered process in lesson text before this sequence block.");
  }
  return checks;
}

/**
 * @param {{
 *   lesson?: object,
 *   pages?: object[],
 *   page?: object,
 *   pageIndex?: number,
 *   block?: object,
 *   blockIndex?: number,
 *   activityType?: string,
 *   diagram?: object,
 *   brain?: object,
 * }} input
 */
function generateTeacherBrainBrief(input = {}) {
  const block = input.block || {};
  const activityType = normalizeActivityType(
    input.activityType || block.type || "unknown"
  );
  const pages = Array.isArray(input.pages) ? input.pages : [];
  const pageIndex = typeof input.pageIndex === "number" ? input.pageIndex : 0;
  const blockIndex = typeof input.blockIndex === "number" ? input.blockIndex : 0;
  const lesson = input.lesson || {};
  const diagram = input.diagram || null;
  const brain = input.brain || {};

  const surrounding = collectSurroundingBlocks(pages, pageIndex, blockIndex);
  const vocab = extractLessonVocabulary(surrounding);

  const purpose = buildPurpose(activityType, lesson, block, vocab);
  const commonMisconceptions = buildCommonMisconceptions(vocab, brain.misconceptions);

  let activityParts = {};
  let contentDerived = false;
  if (activityType === "dragDropMatch") {
    activityParts = buildDragDropBrief(block, lesson, vocab, diagram);
    contentDerived = activityParts.contentDerived;
  } else if (activityType === "interactiveSequence") {
    activityParts = buildSequenceBrief(block, lesson, vocab, diagram);
    contentDerived = activityParts.contentDerived;
  } else if (activityType === "checkpoint") {
    activityParts = buildCheckpointBrief(block, lesson, vocab);
    contentDerived = Boolean(safeStr(block?.correctAnswer) || vocab.vocabulary.length);
  } else if (activityType === "examQuestion") {
    activityParts = buildExamQuestionBrief(block, lesson, vocab);
    contentDerived = vocab.termDefinitions.length > 0;
  }

  const qualityChecks = buildQualityChecks(activityType, activityParts);

  return {
    activityType,
    contentDerived,
    purpose,
    suggestedCards: activityParts.suggestedCards || [],
    suggestedSteps: activityParts.suggestedSteps || [],
    correctAnswer: activityParts.correctAnswer,
    distractorRationale: activityParts.distractorRationale,
    examinerReason: activityParts.examinerReason,
    targetSkill: activityParts.targetSkill,
    marksLogic: activityParts.marksLogic,
    expectedAnswerStructure: activityParts.expectedAnswerStructure,
    commonMisconceptions,
    assessmentFocus: activityParts.assessmentFocus || [],
    studentTask: activityParts.studentTask || "",
    qualityChecks,
    vocabulary: vocab.vocabulary,
  };
}

module.exports = {
  generateTeacherBrainBrief,
  normalizeActivityType,
};
