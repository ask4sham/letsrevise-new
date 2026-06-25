const mongoose = require("mongoose");

/** Optional ObjectId fields on lesson page blocks — empty string must not reach Mongoose. */
const LESSON_BLOCK_OPTIONAL_OBJECTID_FIELDS = ["visualId"];

/**
 * LessonPageBlockSchema stores markScheme as String; page.checkpoint uses [String].
 * Coerce block-level arrays (legacy/editor) to newline-separated text before save.
 * @param {unknown} markScheme
 * @returns {string|undefined}
 */
function normalizeBlockMarkSchemeForDb(markScheme) {
  if (markScheme == null) return undefined;
  if (typeof markScheme === "string") {
    const trimmed = markScheme.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(markScheme)) {
    const joined = markScheme
      .map((line) => String(line ?? "").trim())
      .filter(Boolean)
      .join("\n");
    return joined || undefined;
  }
  return undefined;
}

/**
 * @param {unknown[]} pages
 * @returns {unknown[]}
 */
function normalizeLessonPagesBlockMarkScheme(pages) {
  if (!Array.isArray(pages)) return pages;
  return pages.map((page) => {
    if (!page || typeof page !== "object") return page;
    const next = { ...page };
    if (Array.isArray(next.blocks)) {
      next.blocks = next.blocks.map((block) => {
        if (!block || typeof block !== "object") return block;
        if (!Object.prototype.hasOwnProperty.call(block, "markScheme")) return block;
        const normalized = normalizeBlockMarkSchemeForDb(block.markScheme);
        const out = { ...block };
        if (normalized) out.markScheme = normalized;
        else delete out.markScheme;
        return out;
      });
    }
    return next;
  });
}

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
      if (Object.prototype.hasOwnProperty.call(block, "_intent")) {
        delete block._intent;
      }
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

      if (Object.prototype.hasOwnProperty.call(block, "markScheme")) {
        const normalized = normalizeBlockMarkSchemeForDb(block.markScheme);
        if (normalized) block.markScheme = normalized;
        else delete block.markScheme;
      }
    }
  }

  return next;
}

/**
 * Re-read pages from Mongo (raw BSON) and normalise block markScheme before save.
 * Needed when legacy array values fail Mongoose cast on findById but remain in the DB.
 * @param {import('mongoose').Document} lesson
 */
async function rehydrateLessonPagesMarkSchemeFromDb(lesson) {
  if (!lesson?._id) return;
  const Lesson = lesson.constructor;
  const raw = await Lesson.collection.findOne({ _id: lesson._id }, { projection: { pages: 1 } });
  const pages = raw?.pages ?? lesson.pages ?? [];
  const safe = makeLessonDbSafe({ pages });
  lesson.pages = safe.pages;
  lesson.markModified("pages");
}

module.exports = {
  makeLessonDbSafe,
  normalizeBlockMarkSchemeForDb,
  normalizeLessonPagesBlockMarkScheme,
  rehydrateLessonPagesMarkSchemeFromDb,
  LESSON_BLOCK_OPTIONAL_OBJECTID_FIELDS,
};
