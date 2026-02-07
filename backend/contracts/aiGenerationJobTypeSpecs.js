const { JOB_TYPES } = require("./aiGenerationJobContract");

// Per-job-type specifications for input/output shapes (documentation-only, no runtime logic).
const TYPE_SPECS = {
  [JOB_TYPES.LESSON_DRAFT]: {
    description: "Generate a draft lesson structure (title, summary, blocks) for a given topic/level.",
    inputRequiredKeys: ["topic", "level"],
    inputOptionalKeys: [
      "constraints",
      "style",
      "length",
      "language",
      "curriculumId",
      "lessonId",
    ],
    outputKeys: ["title", "summary", "blocks"],
  },

  [JOB_TYPES.QUIZ_DRAFT]: {
    description: "Generate a draft quiz (set of questions) for a topic/level.",
    inputRequiredKeys: ["topic", "level"],
    inputOptionalKeys: [
      "numQuestions",
      "questionTypes",
      "difficulty",
      "language",
      "lessonId",
    ],
    outputKeys: ["questions"],
  },

  [JOB_TYPES.ASSESSMENT_PAPER_DRAFT]: {
    description: "Generate a draft assessment paper for a subject/level, with sections and mark scheme.",
    inputRequiredKeys: ["subject", "level"],
    inputOptionalKeys: [
      "durationMinutes",
      "sections",
      "rubric",
      "language",
      "curriculumId",
    ],
    outputKeys: ["sections", "markScheme", "rubric"],
  },
};

module.exports = { TYPE_SPECS };

