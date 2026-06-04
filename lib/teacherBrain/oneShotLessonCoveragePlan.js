/**
 * One-shot lesson JSON generator — coverage plan appendix (Phase 4).
 * Plans checkpoint / self-check / quiz / activity / step-by-step assignments before V4 prompt.
 */

const { runTeacherBrain } = require("./TeacherBrainEngine");
const {
  createCoverageGenerationGate,
  planCoverageGatedQuestionBatch,
  formatCoveragePlanForPrompt,
} = require("./coverageGatedGeneration");
const {
  formatSubTopicBoundaryAppendix,
  formatBoundaryReplacementAppendix,
  buildSubTopicBoundaryContext,
} = require("./subTopicBoundaryPlanning");
const { formatObjectiveBoundaryAppendix } = require("./objectiveBoundaryEnforcer");
const { formatConceptPriorityAppendix } = require("./conceptPriorityEngine");
const { formatStructureFunctionPedagogyAppendix, resolvePedagogyProfile } = require("./structureFunctionPedagogyEngine");
const { buildReasoningAppendix, resolveReasoningProfile } = require("./gcseReasoningEngine");
const { formatInteractionAuthorityAppendix } = require("./interactionAuthorityLayer");
const {
  formatConceptCompressionAppendix,
  resolveCompressionProfile,
} = require("./conceptCompressionEngine");

const PLAN_MARKER = "--- ONE-SHOT LESSON COVERAGE PLAN (Phase 4)";

/** Assessment slots the one-shot JSON generator should fill with variety. */
const DEFAULT_ONE_SHOT_SLOTS = [
  { generationKind: "checkpoint", label: "Page checkpoint (early)" },
  { generationKind: "checkpoint", label: "Page checkpoint (mid)" },
  { generationKind: "checkpoint", label: "Self-check question block" },
  { generationKind: "quiz", label: "In-lesson or end quiz MCQ" },
  { generationKind: "activity", label: "Drag & drop or label diagram activity" },
  { generationKind: "activity", label: "Interactive diagram / hotspot task" },
  { generationKind: "retrieval", label: "Step-by-step reveal test question" },
  { generationKind: "exam", label: "Exam practice (structured response)" },
];

/**
 * @param {object} coverageMap
 */
function formatExistingJourneySection(coverageMap) {
  if (!coverageMap?.concepts?.length) return "";
  const lines = [
    "CONCEPTS ALREADY ASSIGNED IN THIS LESSON JOURNEY (from existing blocks / banks):",
  ];
  for (const c of coverageMap.concepts) {
    if (c.taughtCount + c.testedCount === 0) continue;
    const flags = [];
    if (c.isCentral) flags.push("central objective");
    if (c.isOverTested) flags.push("over-tested — do NOT add more");
    lines.push(
      `- ${c.name}: taught ${c.taughtCount}, tested ${c.testedCount}${flags.length ? ` [${flags.join("; ")}]` : ""}`
    );
  }
  return lines.join("\n");
}

/**
 * @param {object} coverageMap
 * @param {object[]} coreConcepts
 */
function formatDoNotOverTestSection(coverageMap, coreConcepts = []) {
  const centralId = coverageMap?.centralConceptId;
  const over = (coverageMap?.concepts || []).filter(
    (c) => c.isOverTested && c.id !== centralId
  );
  const highTest = (coverageMap?.concepts || []).filter(
    (c) => !c.isOverTested && c.id !== centralId && c.testedCount >= 1
  );

  const lines = ["CONCEPTS THAT MUST NOT BE OVER-TESTED (use alternatives):"];
  if (!over.length && !highTest.length) {
    lines.push("- None yet — balance across the concept chain.");
    return lines.join("\n");
  }
  for (const c of over) {
    lines.push(`- ${c.name} — already tested ${c.testedCount} times. Do NOT add another recall/sequence question on this.`);
  }
  for (const c of highTest) {
    lines.push(`- ${c.name} — tested ${c.testedCount} time(s). Prefer a different concept unless higher-order skill.`);
  }

  const under = (coverageMap?.concepts || [])
    .filter((c) => c.testedCount === 0 && c.id !== "unmapped")
    .slice(0, 6);
  if (under.length) {
    lines.push("", "PREFER THESE UNDER-TESTED CONCEPTS INSTEAD:");
    for (const c of under) {
      lines.push(`- ${c.name}`);
    }
  }
  return lines.join("\n");
}

/**
 * @param {object[]} plans — { diagnostic }
 * @param {object[]} slotDefs
 */
function formatSlotAssignments(plans, slotDefs) {
  const lines = [
    "REQUIRED VARIETY — assign each generated assessment block as follows:",
    "(Rotate cognitive skills: Recall → Explain → Apply → Analyse → Evaluate)",
  ];
  plans.forEach((p, i) => {
    const def = slotDefs[i] || {};
    const d = p.diagnostic;
    const avoid =
      d.avoidedDuplicates?.length > 0
        ? ` Avoid: ${d.avoidedDuplicates.map((a) => a.conceptName).join(", ")}.`
        : "";
    lines.push(
      `- ${def.label || `Slot ${i + 1}`}: target "${d.conceptName || "lesson objective"}" with ${d.cognitiveSkill} skill.${avoid}`
    );
  });
  lines.push(
    "",
    "RULE: If the central concept is already tested in drag/drop and step-by-step,",
    "do NOT create another simple pathway/sequence recall checkpoint — prefer under-tested in-scope concepts.",
    "",
    "Self-check blocks count as tested concepts. Do not duplicate the same definition/pathway MCQ."
  );
  return lines.join("\n");
}

/**
 * Build coverage plan appendix for one-shot lesson JSON generation.
 * @param {object} ctx
 * @param {string} ctx.topic
 * @param {object[]} [ctx.pages] — seed pages when regenerating / editing
 * @param {object} [ctx.quiz]
 * @param {object[]} [ctx.flashcards]
 * @param {object[]} [ctx.practiceQuestions]
 * @param {object[]} [ctx.slotDefs]
 */
function buildOneShotLessonCoveragePlanAppendix(ctx = {}) {
  const topic = String(ctx.topic || "").trim();
  if (!topic) return "";

  const brain = runTeacherBrain({
    topic,
    topicKey: ctx.topicKey,
    subTopic: ctx.subTopic,
    subject: ctx.subject || "Biology",
    examBoard: ctx.examBoard || ctx.board || "AQA",
    tier: ctx.tier || "Higher",
    pages: ctx.pages,
    quiz: ctx.quiz,
    lessonId: ctx.lessonId,
  });

  const gate = createCoverageGenerationGate({
    topic,
    topicKey: ctx.topicKey,
    subTopic: ctx.subTopic,
    subject: ctx.subject || brain.subject,
    examBoard: ctx.examBoard || brain.examBoard,
    tier: ctx.tier || brain.tier,
    pages: ctx.pages,
    quiz: ctx.quiz,
    flashcards: ctx.flashcards,
    practiceQuestions: ctx.practiceQuestions,
    coreConcepts: brain.coreConcepts,
    misconceptions: brain.misconceptions,
    lessonId: ctx.lessonId,
  });

  const slotDefs = Array.isArray(ctx.slotDefs) && ctx.slotDefs.length
    ? ctx.slotDefs
    : DEFAULT_ONE_SHOT_SLOTS;

  const plans = [];
  for (const slot of slotDefs) {
    const batch = planCoverageGatedQuestionBatch(gate, 1, slot.generationKind);
    plans.push(...batch);
  }

  const boundarySection = formatSubTopicBoundaryAppendix(gate.boundary);
  const objectiveBoundarySection = formatObjectiveBoundaryAppendix(
    gate.boundary?.subTopicProfile || buildSubTopicBoundaryContext(ctx).subTopicProfile,
    gate.boundary?.boundaryMode
  );
  const replacementSection = formatBoundaryReplacementAppendix(
    gate.replacementPlan || gate.boundary?.replacementPlan
  );
  const prioritySection = formatConceptPriorityAppendix(
    gate.priorityProfile || gate.boundary?.priorityProfile
  );
  const pedagogySection = formatStructureFunctionPedagogyAppendix(
    resolvePedagogyProfile({
      topicKey: ctx.topicKey,
      subTopic: ctx.subTopic,
      subTopicProfile: gate.boundary?.subTopicProfile,
    })
  );
  const reasoningSection = buildReasoningAppendix(
    resolveReasoningProfile({
      topicKey: ctx.topicKey,
      subTopic: ctx.subTopic,
      subTopicProfile: gate.boundary?.subTopicProfile,
    })
  );
  const interactionAuthoritySection = formatInteractionAuthorityAppendix(
    gate.interactionAuthority || gate.boundary?.interactionAuthority
  );
  const compressionSection = formatConceptCompressionAppendix(
    resolveCompressionProfile({
      topicKey: ctx.topicKey,
      subTopic: ctx.subTopic,
      topic: ctx.topic,
      subTopicProfile: gate.boundary?.subTopicProfile,
    })
  );

  const sections = [
    PLAN_MARKER,
    "",
    compressionSection,
    "",
    boundarySection,
    "",
    objectiveBoundarySection,
    "",
    prioritySection,
    "",
    pedagogySection,
    "",
    reasoningSection,
    "",
    interactionAuthoritySection,
    "",
    replacementSection,
    "",
    formatExistingJourneySection(gate.coverageMap),
    "",
    formatDoNotOverTestSection(gate.coverageMap, brain.coreConcepts),
    "",
    formatSlotAssignments(plans, slotDefs),
    "",
    formatCoveragePlanForPrompt(gate.working),
  ].filter(Boolean);

  return {
    appendix: sections.join("\n"),
    marker: PLAN_MARKER,
    gate,
    plans,
    brain,
  };
}

/**
 * Merge one-shot coverage plan into additionalInstructions (idempotent).
 * @param {string} additionalInstructions
 * @param {object} ctx
 */
function mergeOneShotCoveragePlanIntoInstructions(additionalInstructions = "", ctx = {}) {
  const base = String(additionalInstructions || "").trim();
  if (base.includes(PLAN_MARKER)) return base;
  const { appendix } = buildOneShotLessonCoveragePlanAppendix(ctx);
  if (!appendix) return base;
  return base ? `${base}\n\n${appendix}` : appendix;
}

module.exports = {
  PLAN_MARKER,
  DEFAULT_ONE_SHOT_SLOTS,
  buildOneShotLessonCoveragePlanAppendix,
  mergeOneShotCoveragePlanIntoInstructions,
};
