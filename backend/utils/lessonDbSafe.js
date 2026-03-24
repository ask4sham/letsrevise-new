const mongoose = require("mongoose");

/** Optional ObjectId fields on lesson page blocks — empty string must not reach Mongoose. */
const LESSON_BLOCK_OPTIONAL_OBJECTID_FIELDS = ["visualId"];

/**
 * Deep-clone lesson-shaped payload and strip invalid / empty ObjectId-like fields before Mongoose save.
 * OpenAI structured output may use visualId: ""; the DB schema expects a real ObjectId or omission.
 *
 * @param {Object} lesson - Must include `pages` array (other keys pass through on the clone).
 * @returns {Object} Cloned lesson with cleaned pages.
 */
function makeLessonDbSafe(lesson) {
  if (!lesson || typeof lesson !== "object") return lesson;
  const next = JSON.parse(JSON.stringify(lesson));

  for (const page of next.pages || []) {
    if (!page || typeof page !== "object") continue;

    const vm = page.visualModelId;
    if (vm === "" || vm === null || vm === undefined) {
      delete page.visualModelId;
    } else {
      const vmStr = String(vm).trim();
      if (!mongoose.Types.ObjectId.isValid(vmStr)) {
        delete page.visualModelId;
      } else {
        page.visualModelId = vmStr;
      }
    }

    for (const block of page.blocks || []) {
      if (!block || typeof block !== "object") continue;
      for (const field of LESSON_BLOCK_OPTIONAL_OBJECTID_FIELDS) {
        const v = block[field];
        if (v === "" || v === null || v === undefined) {
          delete block[field];
          continue;
        }
        const s = String(v).trim();
        if (!mongoose.Types.ObjectId.isValid(s)) {
          delete block[field];
        } else {
          block[field] = s;
        }
      }
    }
  }

  return next;
}

module.exports = {
  makeLessonDbSafe,
  LESSON_BLOCK_OPTIONAL_OBJECTID_FIELDS,
};
