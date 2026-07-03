const { generateTeacherBrainBrief, normalizeActivityType } = require("./generateTeacherBrainBrief");
const {
  formatTeacherBrainBriefNote,
  BRIEF_MARKER: BRIEF_NOTE_MARKER,
} = require("./formatTeacherBrainBriefNote");
const lessonContentExtractor = require("./lessonContentExtractor");

module.exports = {
  generateTeacherBrainBrief,
  normalizeActivityType,
  formatTeacherBrainBriefNote,
  ...lessonContentExtractor,
  BRIEF_NOTE_MARKER,
};
