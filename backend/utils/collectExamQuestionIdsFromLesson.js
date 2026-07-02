const mongoose = require("mongoose");

/** Collect ExamQuestion ids referenced by examQuestion blocks in lesson pages. */
function collectExamQuestionIdsFromLesson(lesson) {
  const ids = new Set();
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  for (const page of pages) {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const block of blocks) {
      const type = String(block?.type ?? "").trim();
      if (type !== "examQuestion") continue;
      const rawId = block?.examQuestionId ?? block?.examQuestionID;
      if (!rawId) continue;
      const id = String(rawId).trim();
      if (mongoose.Types.ObjectId.isValid(id)) ids.add(id);
    }
  }
  return ids;
}

module.exports = { collectExamQuestionIdsFromLesson };
