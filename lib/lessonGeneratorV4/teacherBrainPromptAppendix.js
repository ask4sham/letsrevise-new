/**
 * Teacher Brain → V4 prompt appendix (Phase 2 — guidance only, no block ordering).
 */

const { runTeacherBrain, formatCoverageMapForPrompt } = require("../teacherBrain");
const { buildOneShotLessonCoveragePlanAppendix } = require("../teacherBrain/oneShotLessonCoveragePlan");
const {
  buildSubTopicBoundaryContext,
  formatSubTopicBoundaryAppendix,
} = require("../teacherBrain/subTopicBoundaryPlanning");

const BRAIN_MARKER = "--- Teacher Brain (expert planning)";

/**
 * Resolve topic/subject/board/tier from blueprint + ctx.
 * @param {object} [blueprint]
 * @param {object} [ctx]
 */
function resolveTeacherBrainInput(blueprint = {}, ctx = {}) {
  const topic = String(ctx.topic || blueprint.topic || "").trim();
  if (!topic) return null;

  return {
    topic,
    topicKey: String(ctx.topicKey || blueprint.topicKey || "").trim(),
    subTopic: String(ctx.subTopic || blueprint.subTopic || "").trim(),
    subject: String(ctx.subject || blueprint.subject || "Biology").trim(),
    examBoard: String(
      ctx.examBoard || ctx.board || blueprint.examBoard || blueprint.board || "AQA"
    ).trim(),
    tier: String(ctx.tier || blueprint.tier || "Higher").trim(),
  };
}

/**
 * @param {ReturnType<runTeacherBrain>} brain
 */
function buildTeacherBrainPromptAppendix(brain) {
  if (!brain || !Array.isArray(brain.coreConcepts) || brain.coreConcepts.length === 0) {
    return "";
  }

  const chain =
    brain.coreConcepts[0]?.lessonChain ||
    brain.coreConcepts.map((c) => c.name).join(" → ");

  const lines = [
    BRAIN_MARKER,
    "",
    "Use this as the expert teacher planning brain. Do not copy it mechanically.",
    "Use it to shape the lesson so the output has coherent teaching, strong diagrams,",
    "meaningful activities, and exam-focused retrieval.",
    "",
    "CORE CONCEPT CHAIN (teach in this order):",
    chain,
  ];

  for (const c of brain.coreConcepts) {
    lines.push(
      `- ${c.teachingOrder}. ${c.name}: ${c.summary} (AQA: ${c.aqaExamPhrase || "precise wording"})`
    );
  }

  lines.push("", "TOP MISCONCEPTIONS (address in teaching — not only exam blocks):");
  for (const m of (brain.misconceptions || []).slice(0, 8)) {
    lines.push(`- ${m.conceptId}: Pupils think "${m.misconception}" → ${m.correction}`);
    if (m.examImpact) lines.push(`  Exam: ${m.examImpact}`);
  }

  lines.push("", "DIAGRAM BRIEFS (required — write briefs for teacher; do NOT generate images or placeholders):");
  for (const d of brain.requiredDiagrams || []) {
    lines.push(
      "Diagram needed:",
      `Title: ${d.title}`,
      `Type: ${d.type}`,
      `Purpose: ${d.purpose}`,
      `Must show: ${(d.mustShow || []).join("; ")}`,
      `Hotspots / labels: ${(d.hotspots || []).join("; ")}`,
      `Assessment focus: ${(d.assessmentFocus || []).join("; ")}`,
      `Student task: trace or label using the brief above — no fake "image unavailable" text`,
      ""
    );
  }

  lines.push("RECOMMENDED ACTIVITIES (place after the concept named — types only):");
  for (const a of brain.activityRecommendations || []) {
    const skill = a.cognitiveSkill || a.cognitiveLevel;
    lines.push(`- After ${a.afterConcept}: ${a.activityType} (${skill}) — ${a.rationale}`);
    if (a.coverageRationale) lines.push(`  Coverage: ${a.coverageRationale}`);
  }

  lines.push("", "EXAM TARGETS (build lesson toward these):");
  for (const e of brain.examTargets || []) {
    lines.push(
      `- ${e.markFocus} (${e.commandWord}): ${e.focus} | AQA wording: ${e.aqaWording} | e.g. "${e.exampleStem}"`
    );
  }

  const coverageSection = formatCoverageMapForPrompt(brain.coverageMap);
  if (coverageSection) {
    lines.push("", coverageSection);
  }

  const boundarySection = formatSubTopicBoundaryAppendix(
    buildSubTopicBoundaryContext({
      topic: brain.topic,
      topicKey: brain.topicKey,
      subTopic: brain.subTopic,
    })
  );
  if (boundarySection) {
    lines.push("", boundarySection);
  }

  lines.push("", "RETRIEVAL PLAN:");
  for (const r of brain.retrievalPlan || []) {
    lines.push(
      `- [${r.phase}] ${r.timing}: ${(r.concepts || []).join(", ")} — ${r.format} — ${r.purpose}`
    );
    if (r.stemHint) lines.push(`  Stem hint: ${r.stemHint}`);
  }

  lines.push("", "REQUIRED MEMORY HOOKS:");
  lines.push(`- Lesson chain to repeat: ${chain}`);
  const endRetrieval = (brain.retrievalPlan || []).filter((r) => r.phase === "end lesson");
  for (const r of endRetrieval) {
    if (r.stemHint) lines.push(`- Close with: ${r.stemHint}`);
  }
  const highMis = (brain.misconceptions || []).filter((m) => m.priority === "high");
  for (const m of highMis) {
    lines.push(`- Memory hook: ${m.correction}`);
  }

  return lines.join("\n");
}

/**
 * Run Teacher Brain and return prompt appendix (safe fallback).
 * @param {object} [blueprint]
 * @param {object} [ctx]
 */
function buildTeacherBrainPromptAppendixFromContext(blueprint = {}, ctx = {}) {
  const input = resolveTeacherBrainInput(blueprint, ctx);
  if (!input) return "";

  try {
    const brain = runTeacherBrain({
      ...input,
      topicKey: input.topicKey,
      subTopic: input.subTopic,
      pages: ctx.pages || blueprint.pages,
      quiz: ctx.quiz || blueprint.quiz,
      lessonId: ctx.lessonId || blueprint.lessonId,
    });
    const base = buildTeacherBrainPromptAppendix(brain);
    const oneShot = buildOneShotLessonCoveragePlanAppendix({
      topic: input.topic,
      topicKey: input.topicKey || ctx.topicKey,
      subTopic: input.subTopic || ctx.subTopic,
      subject: input.subject,
      examBoard: input.examBoard,
      tier: input.tier,
      pages: ctx.pages || blueprint.pages,
      quiz: ctx.quiz || blueprint.quiz,
      flashcards: ctx.flashcards,
      practiceQuestions: ctx.practiceQuestions,
      lessonId: ctx.lessonId || blueprint.lessonId,
    });
    const plan = oneShot.appendix || "";
    if (!plan) return base;
    if (base.includes(oneShot.marker)) return base;
    return base ? `${base}\n\n${plan}` : plan;
  } catch {
    return "";
  }
}

module.exports = {
  BRAIN_MARKER,
  resolveTeacherBrainInput,
  buildTeacherBrainPromptAppendix,
  buildTeacherBrainPromptAppendixFromContext,
};
