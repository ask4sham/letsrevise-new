"use strict";

/**
 * Phase 3 — Synthesiser Page Quiz shadow audit (log-only, no persistence changes).
 */

const {
  alignPageQuizCandidates,
  SHADOW_VERSION,
} = require("../../lib/teacherBrain/lessonTruth/alignPageQuizCandidates");
const {
  SYNTHESISER_SOURCE,
  SYNTHESISER_GENERATOR,
} = require("./groundLessonQuizBeforePersist");

function findPageQuizQuestions(doc) {
  const pages = Array.isArray(doc?.pages) ? doc.pages : [];
  for (const page of pages) {
    for (const block of page?.blocks || []) {
      if (block?.type === "pageQuiz" && Array.isArray(block.questions) && block.questions.length) {
        return block.questions;
      }
    }
  }
  return null;
}

function extractAuditContext(doc) {
  const syn = doc?.metadata?.synthesiser || {};
  return {
    source: String(syn.source || SYNTHESISER_SOURCE),
    generator: String(syn.generator || SYNTHESISER_GENERATOR),
    topicKey: String(doc?.topicKey || ""),
    specKey: String(doc?.specKey || ""),
  };
}

function buildShadowLogEvent(doc, audit) {
  const ctx = extractAuditContext(doc);
  return {
    version: audit.version || SHADOW_VERSION,
    source: ctx.source,
    generator: ctx.generator,
    topicKey: ctx.topicKey,
    specKey: ctx.specKey,
    status: audit.status,
    reason: audit.reason || null,
    questionCount: audit.summary?.total ?? 0,
    accept: audit.summary?.accept ?? 0,
    review: audit.summary?.review ?? 0,
    regenerate: audit.summary?.regenerate ?? 0,
    lessonTruthHash: audit.lessonTruthHash ?? null,
    results: (audit.results || []).map((row) => ({
      questionId: row.questionId,
      slotIndex: row.slotIndex,
      assignedTargetId: row.assignedTargetId,
      verdict: row.verdict,
      reasonCodes: row.reasonCodes,
      discoveredConceptIds: row.discoveredConceptIds,
    })),
  };
}

function runSynthesiserPageQuizShadowAudit(createDoc) {
  const questions = findPageQuizQuestions(createDoc);
  if (!questions) {
    return {
      version: SHADOW_VERSION,
      status: "skipped",
      reason: "NO_PAGEQUIZ_BANK",
      lessonTruthHash: null,
      targets: [],
      results: [],
      summary: { total: 0, accept: 0, review: 0, regenerate: 0 },
    };
  }

  return alignPageQuizCandidates({
    lesson: createDoc,
    questions,
  });
}

function logSynthesiserPageQuizShadowAudit(createDoc, audit) {
  const event = buildShadowLogEvent(createDoc, audit);
  console.log("[TeacherBrain][PageQuizShadow]", JSON.stringify(event));
  return event;
}

function auditAndLogSynthesiserPageQuizShadow(createDoc) {
  const audit = runSynthesiserPageQuizShadowAudit(createDoc);
  if (audit.status === "ok") {
    logSynthesiserPageQuizShadowAudit(createDoc, audit);
  }
  return audit;
}

module.exports = {
  findPageQuizQuestions,
  runSynthesiserPageQuizShadowAudit,
  logSynthesiserPageQuizShadowAudit,
  auditAndLogSynthesiserPageQuizShadow,
  buildShadowLogEvent,
};
