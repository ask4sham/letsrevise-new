/**
 * PR-HARD-3: Verify required unique indexes exist for fingerprinted collections.
 * Logs warning (does not crash) if missing. Run on server startup or via script.
 */
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const TopicPastPaper = require("../models/TopicPastPaper");

const REQUIRED_INDEX = { ownerId: 1, topicKey: 1, fingerprint: 1 };

function indexKeysMatch(a, b) {
  const keysA = Object.keys(a).sort().join(",");
  const keysB = Object.keys(b).sort().join(",");
  if (keysA !== keysB) return false;
  for (const k of Object.keys(a)) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

async function hasRequiredUniqueIndex(Model) {
  try {
    const indexes = await Model.collection.listIndexes().toArray();
    return indexes.some(
      (idx) => idx.unique === true && indexKeysMatch(idx.key || {}, REQUIRED_INDEX)
    );
  } catch (e) {
    return false;
  }
}

async function verifyIndexes() {
  const results = [];
  const models = [
    { name: "TopicFlashcard", Model: TopicFlashcard },
    { name: "TopicQuizQuestion", Model: TopicQuizQuestion },
    { name: "TopicPastPaper", Model: TopicPastPaper },
  ];

  for (const { name, Model } of models) {
    try {
      const ok = await hasRequiredUniqueIndex(Model);
      results.push({ collection: Model.collection.name, ok });
      if (!ok) {
        console.warn(
          `[PR-HARD-3] Missing unique index on ${name} (ownerId, topicKey, fingerprint). ` +
            `Run: npm run migrate:all . Then ensure schema indexes exist (Mongoose syncIndexes or manual createIndex).`
        );
      }
    } catch (e) {
      results.push({ collection: Model.collection.name, ok: false, error: e.message });
      console.warn(`[PR-HARD-3] Could not verify indexes for ${name}:`, e.message);
    }
  }

  const missing = results.filter((r) => !r.ok);
  if (missing.length > 0) {
    console.warn(
      `[PR-HARD-3] ${missing.length} collection(s) may be missing required indexes. ` +
        `See docs/runbook.md "What to do if unique index conflicts appear".`
    );
  }
  return { ok: missing.length === 0, results };
}

module.exports = { verifyIndexes, REQUIRED_INDEX };
