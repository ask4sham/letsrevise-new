/**
 * PR-F1: Seed lesson.flashcards from TopicFlashcard bank by topicKey.
 * Used by: lesson factory (auto-seed) and POST /lessons/:id/seed-flashcards-from-topic.
 * PR-CHEM-3: Query by $in(namespaced, legacy) so both formats are found.
 */
const TopicFlashcard = require("../models/TopicFlashcard");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("./topicKey");

const DEFAULT_LIMIT = 20;

/**
 * Map DB cards to lesson-style array (shared by both fetch functions).
 */
function mapToLessonCards(cards) {
  return cards.map((c) => ({
    id: String(c._id),
    front: c.front || "",
    back: c.back || "",
    difficulty: 1,
    tags: [],
    source: "topic-bank",
    topicBankId: String(c._id),
  }));
}

/**
 * Fetch topic flashcards for an owner and topicKey, return lesson-style flashcard array.
 * @param {ObjectId|string} ownerId - Lesson owner / teacher
 * @param {string} topicKey - Canonical topic key (e.g. cell-structure or aqa-gcse-chemistry:rate-of-reaction)
 * @param {number} [limit=20] - Max cards to return
 * @param {Object} [opts] - { publishedOnly: true, specKey?: string } for generate-from-bank (PR-FLOW-2)
 * @returns {Promise<Array<{id, front, back, difficulty, tags}>>}
 */
async function fetchTopicFlashcardsForSeed(ownerId, topicKey, limit = DEFAULT_LIMIT, opts = {}) {
  if (!topicKey || typeof topicKey !== "string" || !topicKey.trim()) return [];
  const specKey = (opts.specKey && String(opts.specKey).trim()) || DEFAULT_SPEC_LEGACY;
  const parsed = parseTopicKey(topicKey.trim());
  const topicOnly = parsed.topicKey || topicKey.trim().toLowerCase();
  const candidates = queryCandidates(specKey, topicOnly);
  const statusFilter = opts.publishedOnly ? { status: "published" } : { status: { $in: ["draft", "published"] } };
  const cards = await TopicFlashcard.find({
    ownerId,
    topicKey: candidates.length ? { $in: candidates } : topicOnly,
    ...statusFilter,
  })
    .sort({ updatedAt: -1 })
    .limit(Math.min(limit, 50))
    .lean();
  return mapToLessonCards(cards);
}

/**
 * Fetch published topic flashcards for a topicKey only (no ownerId).
 * Used as fallback when teacher-owned query returns 0 so platform/admin-owned bank cards are still synced.
 * @param {string} topicKey - Canonical topic key (namespaced or legacy)
 * @param {number} [limit=50] - Max cards to return
 * @param {Object} [opts] - { publishedOnly: true, specKey?: string }
 * @returns {Promise<Array<{id, front, back, difficulty, tags, source, topicBankId}>>}
 */
async function fetchTopicFlashcardsForTopicOnly(topicKey, limit = DEFAULT_LIMIT, opts = {}) {
  if (!topicKey || typeof topicKey !== "string" || !topicKey.trim()) return [];
  const specKey = (opts.specKey && String(opts.specKey).trim()) || DEFAULT_SPEC_LEGACY;
  const parsed = parseTopicKey(topicKey.trim());
  const topicOnly = parsed.topicKey || topicKey.trim().toLowerCase();
  const candidates = queryCandidates(specKey, topicOnly);
  const statusFilter = opts.publishedOnly ? { status: "published" } : { status: { $in: ["draft", "published"] } };
  const cards = await TopicFlashcard.find({
    topicKey: candidates.length ? { $in: candidates } : topicOnly,
    ...statusFilter,
  })
    .sort({ updatedAt: -1 })
    .limit(Math.min(limit, 50))
    .lean();
  return mapToLessonCards(cards);
}

module.exports = { fetchTopicFlashcardsForSeed, fetchTopicFlashcardsForTopicOnly, DEFAULT_LIMIT };
