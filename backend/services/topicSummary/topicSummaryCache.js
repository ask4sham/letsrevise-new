/**
 * PR-024: Topic summary cache — 24h TTL.
 * Key: sha256(specKey|topicKey|mode|maxSources|allowExternal|studentSafe)
 */
const crypto = require("crypto");
const TopicSummaryCache = require("../../models/TopicSummaryCache");

function buildCacheKey(specKey, topicKey, mode, maxSources, allowExternal, studentSafe = false) {
  const raw = `${(specKey || "").trim()}|${(topicKey || "").trim()}|${(mode || "overview")}|${Number(maxSources) || 14}|${allowExternal ? "1" : "0"}|${studentSafe ? "1" : "0"}`;
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

async function getCached(specKey, topicKey, mode, maxSources, allowExternal, studentSafe = false) {
  try {
    const key = buildCacheKey(specKey, topicKey, mode, maxSources, allowExternal, studentSafe);
    const doc = await TopicSummaryCache.findOne({ key }).lean();
    if (!doc || !doc.response) return { hit: false };
    return { hit: true, response: doc.response };
  } catch (e) {
    if (process.env.NODE_ENV !== "test") console.warn("[topicSummaryCache] get error:", e.message);
    return { hit: false };
  }
}

async function setCached(specKey, topicKey, mode, maxSources, allowExternal, response, studentSafe = false) {
  try {
    const key = buildCacheKey(specKey, topicKey, mode, maxSources, allowExternal, studentSafe);
    await TopicSummaryCache.findOneAndUpdate(
      { key },
      {
        $set: {
          specKey: (specKey || "").trim(),
          topicKey: (topicKey || "").trim(),
          mode: (mode || "overview").trim(),
          response,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (e) {
    if (process.env.NODE_ENV !== "test") console.warn("[topicSummaryCache] set error:", e.message);
  }
}

module.exports = { getCached, setCached, buildCacheKey };
