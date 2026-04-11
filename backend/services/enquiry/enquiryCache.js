/**
 * PR-006: Enquiry cache — avoid repeated LLM calls for identical queries.
 * Key: sha256(specKey|topicKey|mode|normalizedQuestion)
 */
const crypto = require("crypto");
const EnquiryCache = require("../../models/EnquiryCache");

const TTL_SECONDS = 86400; // 24h

function normalizeQuestion(q) {
  if (q == null || typeof q !== "string") return "";
  return q
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * PR-019: Include conversationId so cache does not leak across conversations.
 * PR-020: Include responseMode so different modes return different cached responses.
 * PR-021: Include allowExternal so external vs curriculum-only are cached separately.
 * Lesson-local retrieval: include lessonId when present so cache does not leak across lessons.
 */
function buildCacheKey(specKey, topicKey, mode, question, conversationId = null, responseMode = null, allowExternal = false, lessonId = null) {
  // Coerce to string — non-strings (e.g. numbers from JSON) would throw on .trim() and take down /api/enquiry.
  const spec = String(specKey ?? "").trim();
  const topic = String(topicKey ?? "").trim();
  const m = String(mode ?? "").trim();
  const q = normalizeQuestion(question);
  const conv = conversationId ? String(conversationId).trim() : "";
  const rm = String(responseMode ?? "").trim() || "explain";
  const ext = allowExternal ? "1" : "0";
  const les = lessonId ? String(lessonId).trim() : "";
  // When no lessonId, keep raw string identical to pre–lesson-local keys (no trailing empty segment).
  const raw = les ? `${spec}|${topic}|${m}|${q}|${conv}|${rm}|${ext}|${les}` : `${spec}|${topic}|${m}|${q}|${conv}|${rm}|${ext}`;
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Get cached response if exists.
 * @returns {{ hit: boolean, response?: object }}
 */
async function getCached(specKey, topicKey, mode, question, conversationId = null, responseMode = null, allowExternal = false, lessonId = null) {
  try {
    const key = buildCacheKey(specKey, topicKey, mode, question, conversationId, responseMode, allowExternal, lessonId);
    const doc = await EnquiryCache.findOne({ key }).lean();
    if (!doc || !doc.response) return { hit: false };
    return {
      hit: true,
      response: {
        question: doc.response.question,
        specKey: doc.specKey,
        topicKey: doc.topicKey,
        usedSources: doc.response.usedSources || [],
        answer: doc.response.answer || {},
        ...(doc.response.externalUsed && {
          externalUsed: true,
          externalSources: doc.response.externalSources || [],
          ...(doc.response.externalExamContextUsed && { externalExamContextUsed: true }),
        }),
        ...(doc.response.learningSuggestions && doc.response.learningSuggestions.length > 0 && {
          learningSuggestions: doc.response.learningSuggestions,
        }),
      },
    };
  } catch (e) {
    if (process.env.NODE_ENV !== "test") console.warn("[enquiryCache] get error:", e.message);
    return { hit: false };
  }
}

/**
 * Store response in cache.
 */
async function setCached(specKey, topicKey, mode, question, response, conversationId = null, responseMode = null, allowExternal = false, lessonId = null) {
  try {
    const key = buildCacheKey(specKey, topicKey, mode, question, conversationId, responseMode, allowExternal, lessonId);
    await EnquiryCache.findOneAndUpdate(
      { key },
      {
        $set: {
          specKey: (specKey || "").trim(),
          topicKey: (topicKey || "").trim() || null,
          mode: (mode || "").trim() || null,
          response: {
            question: response.question,
            usedSources: response.usedSources,
            answer: response.answer,
            ...(response.externalUsed && {
              externalUsed: true,
              externalSources: response.externalSources || [],
              ...(response.externalExamContextUsed && { externalExamContextUsed: true }),
            }),
            ...(response.learningSuggestions && response.learningSuggestions.length > 0 && {
              learningSuggestions: response.learningSuggestions,
            }),
          },
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (e) {
    if (process.env.NODE_ENV !== "test") console.warn("[enquiryCache] set error:", e.message);
  }
}

module.exports = { getCached, setCached, buildCacheKey, normalizeQuestion };
