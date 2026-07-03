/**
 * Format structured Teacher Brain Brief → block.note text.
 */

const BRIEF_MARKER = "--- TEACHER BRAIN DESIGN BRIEF ---";

function dotList(items = []) {
  return items.map((item) => `• ${item}`).join("\n");
}

function formatDragDropNote(brief) {
  const cards = (brief.suggestedCards || []).map((c) => c.prompt).filter(Boolean);
  const correctMatches = (brief.suggestedCards || [])
    .filter((c) => c.prompt && c.answer)
    .map((c) => `${c.prompt} → ${c.answer}`);

  const lines = [
    BRIEF_MARKER,
    "",
    "DRAG & DROP BRIEF",
    "",
    `Purpose:\n${brief.purpose || "Match concepts using lesson vocabulary."}`,
    "",
    "Suggested cards:",
    cards.length ? dotList(cards) : "• (Add structure/function cards from lesson content above)",
    "",
    "Correct matches:",
    correctMatches.length
      ? dotList(correctMatches)
      : "• (Pair each structure with its function from the lesson)",
    "",
    "Common misconceptions:",
    brief.commonMisconceptions?.length
      ? dotList(brief.commonMisconceptions)
      : "• (Add misconceptions from commonMistake blocks nearby)",
    "",
    "Assessment focus:",
    brief.assessmentFocus?.length
      ? dotList(brief.assessmentFocus)
      : "• Match structure to function\n• Use precise GCSE vocabulary",
    "",
    "Student task:",
    brief.studentTask || "Drag each card to its correct match.",
    "",
    "Quality checks:",
    dotList(brief.qualityChecks || []),
    "",
    "Do NOT generate images. Teacher builds the card set from this brief.",
  ];
  return lines.join("\n");
}

function formatSequenceNote(brief) {
  const steps = (brief.suggestedSteps || []).map((s, i) => {
    const label = s.label || `Step ${i + 1}`;
    const extra = s.explanation ? ` — ${s.explanation}` : "";
    const misc = s.misconception ? ` [Misconception: ${s.misconception}]` : "";
    return `${i + 1}. ${label}${extra}${misc}`;
  });

  return [
    BRIEF_MARKER,
    "",
    "STEP-BY-STEP BRIEF",
    "",
    `Purpose:\n${brief.purpose || "Order the process steps."}`,
    "",
    "Sequence:",
    steps.length ? steps.join("\n") : "1. (Add ordered steps from lesson pathway content)",
    "",
    "Common misconceptions:",
    brief.commonMisconceptions?.length
      ? dotList(brief.commonMisconceptions)
      : "• (Add from commonMistake blocks)",
    "",
    "Assessment focus:",
    brief.assessmentFocus?.length ? dotList(brief.assessmentFocus) : "• Recall step order",
    "",
    "Student task:",
    brief.studentTask || "Put the steps in the correct order.",
    "",
    "Quality checks:",
    dotList(brief.qualityChecks || []),
    "",
    "Do NOT use placeholder step images. One clear visual per step or one multi-step board diagram.",
  ].join("\n");
}

function formatCheckpointNote(brief) {
  return [
    BRIEF_MARKER,
    "",
    "CHECKPOINT BRIEF",
    "",
    `Purpose:\n${brief.purpose}`,
    "",
    "Correct answer:",
    brief.correctAnswer || "(set from lesson)",
    "",
    "Distractor rationale:",
    Array.isArray(brief.distractorRationale)
      ? dotList(brief.distractorRationale)
      : `• ${brief.distractorRationale || "(add plausible wrong options)"}`,
    "",
    "Examiner reason:",
    brief.examinerReason || "Credits precise cause → effect.",
    "",
    "Assessment focus:",
    brief.assessmentFocus?.length ? dotList(brief.assessmentFocus) : "• AO1 vocabulary",
    "",
    "Student task:",
    brief.studentTask,
    "",
    "Quality checks:",
    dotList(brief.qualityChecks || []),
  ].join("\n");
}

function formatExamQuestionNote(brief) {
  return [
    BRIEF_MARKER,
    "",
    "EXAM QUESTION BRIEF",
    "",
    `Purpose:\n${brief.purpose}`,
    "",
    "Target skill:",
    brief.targetSkill || "Describe and explain",
    "",
    "Marks logic:",
    brief.marksLogic || "Award marks for named structures and linked explanations.",
    "",
    "Expected answer structure:",
    brief.expectedAnswerStructure || "Point → evidence → link",
    "",
    "Assessment focus:",
    brief.assessmentFocus?.length ? dotList(brief.assessmentFocus) : "• Precise GCSE vocabulary",
    "",
    "Student task:",
    brief.studentTask,
    "",
    "Quality checks:",
    dotList(brief.qualityChecks || []),
  ].join("\n");
}

/**
 * @param {object} brief — generateTeacherBrainBrief output
 * @param {{ layout?: string }} [opts]
 */
function formatTeacherBrainBriefNote(brief, opts = {}) {
  const type = brief?.activityType || "unknown";
  if (type === "dragDropMatch") {
    if (opts.layout === "textToImage" || opts.layout === "imageDropZones") {
      return null;
    }
    return formatDragDropNote(brief);
  }
  if (type === "interactiveSequence") return formatSequenceNote(brief);
  if (type === "checkpoint") return formatCheckpointNote(brief);
  if (type === "examQuestion") return formatExamQuestionNote(brief);
  return null;
}

module.exports = {
  BRIEF_MARKER,
  formatTeacherBrainBriefNote,
  formatDragDropNote,
  formatSequenceNote,
};
