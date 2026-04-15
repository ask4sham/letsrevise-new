/**
 * Merge validated checkpoint items into lesson.pages[].checkpoint (teacher or auto-apply).
 */

const { sanitiseAutoMark } = require("./validateCheckpointPayload");

/**
 * @param {import("mongoose").Document} lesson Mongoose Lesson document
 * @param {object[]} items from validateAndNormalizeCheckpointPayload
 * @param {{ onlyIfCheckpointEmpty?: boolean }} opts
 * @returns {{ updatedPages: number }}
 */
function applyCheckpointItemsToLesson(lesson, items, opts = {}) {
  const onlyIfEmpty = opts.onlyIfCheckpointEmpty !== false;
  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  let updated = 0;

  const byPage = new Map(items.map((it) => [String(it.pageId), it]));

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pid = String(page?.pageId || "");
    const item = byPage.get(pid);
    if (!item) continue;

    const existingQ = String(page?.checkpoint?.question || "").trim();
    if (onlyIfEmpty && existingQ.length > 0) continue;

    if (item.type === "mcq") {
      page.checkpoint = {
        type: "mcq",
        question: item.question,
        options: item.options,
        answer: item.answer,
        ...(item.markScheme?.length ? { markScheme: item.markScheme } : {}),
      };
    } else {
      const am = sanitiseAutoMark(item.autoMark);
      page.checkpoint = {
        type: "shortExplain",
        question: item.question,
        options: [],
        answer: "",
        ...(item.markScheme?.length ? { markScheme: item.markScheme } : {}),
        ...(am ? { autoMark: am } : {}),
      };
    }
    updated++;
  }

  lesson.markModified("pages");
  return { updatedPages: updated };
}

module.exports = { applyCheckpointItemsToLesson };
