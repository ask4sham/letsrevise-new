/**
 * Teacher Brain Phase 3 — inject diagram/activity design briefs into lesson blocks.
 * Isolated from V2/V3/V4 scoring and ordering.
 */

const { runTeacherBrain } = require("../../lib/teacherBrain");
const {
  injectDiagramAndActivityBriefs,
  isDiagramActivityBlock,
} = require("../../lib/teacherBrain/diagramBriefInjector");

/**
 * @param {object[]} pages
 * @param {{ topic: string, subject?: string, examBoard?: string, tier?: string, blueprint?: object }} input
 */
function applyTeacherBrainBriefInjection(pages, input = {}) {
  const topic = String(input.topic || input.blueprint?.topic || "").trim();
  if (!topic) {
    return { pages, brain: null, injections: [] };
  }

  const topicKey = String(input.topicKey || input.blueprint?.topicKey || "").trim();
  const subTopic = String(input.subTopic || input.blueprint?.subTopic || "").trim();

  const brain = runTeacherBrain({
    topic,
    topicKey,
    subTopic,
    subject: input.subject || input.blueprint?.subject || "Biology",
    examBoard: input.examBoard || input.blueprint?.examBoard || input.blueprint?.board || "AQA",
    tier: input.tier || input.blueprint?.tier || "Higher",
  });

  const result = injectDiagramAndActivityBriefs(pages, brain, {
    topic: brain.topic || topic,
    topicKey: brain.topicKey || topicKey,
    subTopic: brain.subTopic || subTopic,
  });

  const logInjection =
    process.env.TEACHER_BRAIN_INJECTION_LOG === "1" ||
    process.env.NODE_ENV !== "production";
  if (logInjection) {
    for (const page of result.pages || []) {
      for (const block of page.blocks || []) {
        if (!isDiagramActivityBlock(block)) continue;
        console.log(
          "[TeacherBrain]",
          block.type,
          String(block.note || "").includes("TEACHER BRAIN DESIGN BRIEF")
        );
      }
    }
    console.log("[TeacherBrain] injection complete", {
      topic,
      injectionCount: result.injections?.length ?? 0,
    });
  }

  return {
    pages: result.pages,
    brain,
    injections: result.injections,
  };
}

module.exports = {
  applyTeacherBrainBriefInjection,
  runTeacherBrain,
  injectDiagramAndActivityBriefs,
};
