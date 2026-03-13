/**
 * Topic drift validation: detect when generated content drifts into sibling sub-topics.
 * Used to ensure AI lessons stay strictly within the selected sub-topic.
 * Deterministic keyword-based validation; does not require NLP.
 */
const { getSiblingTopicKeysAndKeywords, findTopicBySpecAndKey } = require("./topicTaxonomy");

/**
 * Phrases that are acceptable in a topic even if they match a sibling topic key.
 * E.g. "eukaryotic"/"prokaryotic" are expected in cell-structure when describing cell types.
 */
const TOPIC_ALLOWLIST = {
  "cell-structure": ["eukaryotic", "prokaryotic", "eukaryotes", "prokaryotes"],
};

/**
 * Build strong drift phrases from sibling topic keys (for deterministic matching).
 * These are whole-word/phrase signals that indicate content from a sibling sub-topic.
 */
function buildStrongDriftPhrases(siblingKeys, topicKeyShort) {
  const phrases = [];
  const added = new Set();

  const keyToPhrases = {
    "mitosis-cell-cycle": ["mitosis", "cell cycle", "mitotic"],
    "cell-division": ["cell division", "dividing cells"],
    "stem-cells": ["stem cell", "stem cells", "embryonic stem"],
    "diffusion": ["diffusion", "diffuses", "diffusing"],
    "factors-affect-diffusion": ["factors affecting diffusion", "diffusion rate"],
    "osmosis": ["osmosis", "osmotic", "water potential gradient"],
    "rp-osmosis": ["osmosis practical", "osmosis experiment"],
    "microscopy": ["microscopy", "light microscope", "electron microscope", "magnification"],
    "rp-microscopy": ["microscopy practical", "preparing a slide"],
    "active-transport": ["active transport", "against the concentration gradient"],
    "cell-differentiation": ["differentiation", "cell differentiation", "differentiated"],
    "cell-specialisation": ["specialisation", "specialised cell", "specialized cell"],
    "eukaryotes-prokaryotes": ["prokaryotic", "eukaryotic", "bacterial cell structure"],
    "animal-plant-cells": ["plant cell only", "animal cell only"],
  };

  const allowlist = (topicKeyShort && TOPIC_ALLOWLIST[topicKeyShort]) || [];

  for (const key of siblingKeys || []) {
    if (keyToPhrases[key]) {
      for (const p of keyToPhrases[key]) {
        const n = p.toLowerCase();
        if (allowlist.includes(n)) continue;
        if (!added.has(n)) {
          added.add(n);
          phrases.push(n);
        }
      }
    } else {
      const fromKey = key.replace(/-/g, " ");
      if (fromKey.length >= 4 && !allowlist.includes(fromKey) && !added.has(fromKey)) {
        added.add(fromKey);
        phrases.push(fromKey);
      }
    }
  }

  return phrases;
}

/**
 * Extract text from lesson blocks for drift checking.
 * @param {Array} pages - Lesson pages with blocks
 * @returns {string} Combined lowercase text
 */
function extractTextFromLesson(pages) {
  if (!Array.isArray(pages)) return "";
  const parts = [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      const content = b?.content ?? b?.prompt ?? "";
      if (typeof content === "string") parts.push(content);
    }
    const cp = p?.checkpoint;
    if (cp?.prompt) parts.push(cp.prompt);
    if (cp?.question) parts.push(cp.question);
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Count whole-word/phrase occurrences in text.
 */
function countPhraseOccurrences(text, phrase) {
  if (!text || !phrase) return 0;
  const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * Validate generated content against selected topic. Detects strong drift into sibling sub-topics.
 * @param {Object} opts
 * @param {string} opts.topicKey - Selected sub-topic key (e.g. "cell-structure")
 * @param {string} opts.specKey - Spec key (e.g. "aqa-gcse-biology")
 * @param {string} [opts.subTopicLabel] - Display label for messages
 * @param {Array} [opts.textBlocks] - Array of text strings (blocks)
 * @param {Array} [opts.pages] - Lesson pages (alternative to textBlocks)
 * @param {Array} [opts.quizItems] - Quiz questions
 * @param {Array} [opts.flashcards] - Flashcards
 * @param {Array} [opts.examQuestions] - Exam questions
 * @returns {{ valid: boolean, warnings: string[], driftedPhrases: string[] }}
 */
function validateGeneratedContentAgainstTopic(opts) {
  const { topicKey, specKey, subTopicLabel } = opts || {};
  const result = { valid: true, warnings: [], driftedPhrases: [] };

  if (!topicKey || !specKey) return result;

  // Extract short form (e.g. "cell-structure") if namespaced ("spec:cell-structure")
  const topicKeyShort = String(topicKey).includes(":") ? String(topicKey).split(":").pop() : topicKey;
  const { siblingKeys, keywords } = getSiblingTopicKeysAndKeywords(topicKeyShort, specKey);
  if (siblingKeys.length === 0) return result;

  const strongPhrases = buildStrongDriftPhrases(siblingKeys, topicKeyShort);
  if (strongPhrases.length === 0) return result;

  let text = "";
  if (Array.isArray(opts.pages)) {
    text = extractTextFromLesson(opts.pages);
  } else if (Array.isArray(opts.textBlocks)) {
    text = opts.textBlocks.map((s) => String(s || "")).join(" ").toLowerCase();
  }

  const quizText = Array.isArray(opts.quizItems)
    ? opts.quizItems.map((q) => (q?.question || q?.prompt || "") + " " + (q?.options || []).join(" ")).join(" ").toLowerCase()
    : "";
  const flashText = Array.isArray(opts.flashcards)
    ? opts.flashcards.map((f) => (f?.front || "") + " " + (f?.back || "")).join(" ").toLowerCase()
    : "";
  const examText = Array.isArray(opts.examQuestions)
    ? opts.examQuestions.map((e) => (e?.question || "") + " " + (e?.markScheme || []).join(" ")).join(" ").toLowerCase()
    : "";

  const fullText = [text, quizText, flashText, examText].join(" ");

  const drifted = [];
  for (const phrase of strongPhrases) {
    const count = countPhraseOccurrences(fullText, phrase);
    if (count >= 2) {
      drifted.push(phrase);
    } else if (count === 1 && phrase.length >= 8) {
      drifted.push(phrase);
    }
  }

  if (drifted.length > 0) {
    result.valid = false;
    result.driftedPhrases = drifted;
    const label = subTopicLabel || topicKey;
    result.warnings.push(
      `Generated content may have drifted into neighbouring sub-topics (detected: ${drifted.slice(0, 5).join(", ")}). ` +
        `Please ensure the lesson stays within: ${label}.`
    );
  }

  return result;
}

/**
 * Filter AI-generated bank items to exclude those with strong sibling-topic drift.
 * @param {Object} opts - { topicKey, specKey, subTopicLabel, flashcards: [], quizItems: [], examQuestions: [] }
 * @returns {{ flashcards: [], quizItems: [], examQuestions: [], removedCount: number, driftedPhrases: string[] }}
 */
function filterBankItemsByDrift(opts) {
  const result = validateGeneratedContentAgainstTopic(opts);
  if (result.valid || !result.driftedPhrases?.length) {
    return {
      flashcards: opts.flashcards || [],
      quizItems: opts.quizItems || [],
      examQuestions: opts.examQuestions || [],
      removedCount: 0,
      driftedPhrases: [],
    };
  }
  const phrases = result.driftedPhrases;
  const phraseInText = (text) => {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase();
    return phrases.some((p) => {
      const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return re.test(lower);
    });
  };

  const origFlash = Array.isArray(opts.flashcards) ? opts.flashcards : [];
  const origQuiz = Array.isArray(opts.quizItems) ? opts.quizItems : [];
  const origExam = Array.isArray(opts.examQuestions) ? opts.examQuestions : [];

  const flashcards = origFlash.filter((f) => !phraseInText((f?.front || "") + " " + (f?.back || "")));
  const quizItems = origQuiz.filter((q) => !phraseInText((q?.question || q?.prompt || "") + " " + (q?.options || []).join(" ")));
  const examQuestions = origExam.filter((e) => !phraseInText((e?.question || "") + " " + (Array.isArray(e?.markScheme) ? e.markScheme.join(" ") : "")));

  const removedCount =
    (origFlash.length - flashcards.length) + (origQuiz.length - quizItems.length) + (origExam.length - examQuestions.length);

  return {
    flashcards,
    quizItems,
    examQuestions,
    removedCount,
    driftedPhrases: phrases,
  };
}

module.exports = {
  validateGeneratedContentAgainstTopic,
  buildStrongDriftPhrases,
  extractTextFromLesson,
  filterBankItemsByDrift,
};
