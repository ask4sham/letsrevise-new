/**
 * Draft Question Library — bulk generation of flashcards and exam questions per SpecStatement.
 *
 * COPYRIGHT-SAFE SOURCING (see docs/ai-content-sourcing-policy.md):
 * - Uses ONLY structured SpecStatements (official exam board specifications already ingested).
 * - Uses internal taxonomy (specKey, topicKey) and approved prompt pack metadata.
 * - Does NOT scrape educational websites.
 * - Does NOT copy or paraphrase textbook/revision-guide wording.
 * - Does NOT import third-party copyrighted teaching explanations.
 * - Generated content must be ORIGINAL wording derived from curriculum facts and requirements.
 *
 * All generated content starts as DRAFT for teacher QA before publishing.
 */
const SpecStatement = require("../models/SpecStatement");
const adminTaxonomyService = require("./adminTaxonomyService");
const { generateFlashcardsForTopic, generateExamQuestionsForTopic } = require("./autopilotGenerationAdapters");
const { normalizeSpecKey } = require("../config/featureFlags");
const { buildTopicKey } = require("../utils/topicKey");
const { queryCandidates } = require("../utils/topicKey");

function getSpecVariants(specKey) {
  const normalized = normalizeSpecKey(specKey);
  const withUnderscores = normalized.replace(/-/g, "_");
  return [...new Set([normalized, withUnderscores])];
}

const DEFAULT_LIMIT_FLASHCARDS = 6;
const DEFAULT_LIMIT_EXAM_QUESTIONS = 2;

/**
 * Check if topicKey is a leaf topic in the taxonomy.
 * @returns {Promise<boolean>}
 */
async function isLeafTopic(specKey, topicOnly) {
  const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy?.units) return false;
  const slug = (topicOnly || "").toLowerCase();
  for (const unit of taxonomy.units) {
    for (const t of unit.topics || []) {
      const key = (t.key || t.topicKey || "").toLowerCase();
      if (key === slug) return true;
    }
  }
  return false;
}

/**
 * Generate draft library for a single topic.
 * Uses ONLY SpecStatements (sourceType: spec_statements_only). Copyright-safe.
 *
 * @param {Object} opts
 * @param {string} opts.specKey
 * @param {string} opts.topicKey - Leaf slug or namespaced
 * @param {string} opts.adminUserId
 * @param {string} [opts.promptPackId]
 * @param {string} [opts.promptPackVersion]
 * @param {number} [opts.limitFlashcards]
 * @param {number} [opts.limitExamQuestions]
 * @param {number} [opts.limitPerTopic]
 * @param {boolean} [opts.dryRun]
 */
async function generateDraftLibraryForTopic({
  specKey,
  topicKey,
  adminUserId,
  promptPackId,
  promptPackVersion,
  limitFlashcards = DEFAULT_LIMIT_FLASHCARDS,
  limitExamQuestions = DEFAULT_LIMIT_EXAM_QUESTIONS,
  limitPerTopic,
  dryRun = false,
}) {
  if (!specKey || !topicKey || !adminUserId) {
    return {
      topicKey: topicKey || "",
      specKey: specKey || "",
      dryRun: !!dryRun,
      skipped: true,
      reason: "missing_params",
      statementsUsed: 0,
      flashcardsGenerated: 0,
      examQuestionsGenerated: 0,
      duplicatesSkipped: 0,
    };
  }

  const normalized = normalizeSpecKey(specKey);
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const topicKeyResolved = (topicKey || "").includes(":") ? topicKey : buildTopicKey(normalized, topicOnly);

  const leaf = await isLeafTopic(normalized, topicOnly);
  if (!leaf) {
    return {
      topicKey: topicKeyResolved,
      specKey: normalized,
      dryRun: !!dryRun,
      skipped: true,
      reason: "non_leaf_topic",
      statementsUsed: 0,
      flashcardsGenerated: 0,
      examQuestionsGenerated: 0,
      duplicatesSkipped: 0,
    };
  }

  const specVariants = getSpecVariants(normalized);
  const candidates = queryCandidates(normalized, topicOnly);

  const statements = await SpecStatement.find({
    specKey: { $in: specVariants },
    topicKey: { $in: candidates },
  })
    .select("statementCode topicKey")
    .lean();

  if (statements.length === 0) {
    return {
      topicKey: topicKeyResolved,
      specKey: normalized,
      dryRun: !!dryRun,
      skipped: true,
      reason: "missing_spec_statements",
      statementsUsed: 0,
      flashcardsGenerated: 0,
      examQuestionsGenerated: 0,
      duplicatesSkipped: 0,
    };
  }

  const effectiveTopicKey = statements[0]?.topicKey || topicKeyResolved;
  const toProcess = limitPerTopic ? statements.slice(0, limitPerTopic) : statements;
  const promptPack = {
    generatorMode: "draft_library",
    sourceType: "spec_statements_only",
    promptPackId: promptPackId || undefined,
    promptPackVersion: promptPackVersion || undefined,
  };

  let flashcardsGenerated = 0;
  let examQuestionsGenerated = 0;
  let duplicatesSkipped = 0;
  const errors = [];

  for (const st of toProcess) {
    const code = (st.statementCode || "").trim();
    if (!code) continue;

    try {
      const fcResult = await generateFlashcardsForTopic({
        specKey: normalized,
        topicKey: effectiveTopicKey,
        count: limitFlashcards,
        adminUserId,
        promptPack,
        initialStatus: "draft",
        statementCodes: [code],
        dryRun,
      });
      if (fcResult.status === "generated") {
        flashcardsGenerated += fcResult.createdCount || 0;
      } else if (fcResult.status === "skipped") {
        duplicatesSkipped += 1;
      }

      const eqResult = await generateExamQuestionsForTopic({
        specKey: normalized,
        topicKey: effectiveTopicKey,
        count: limitExamQuestions,
        adminUserId,
        promptPack,
        initialStatus: "draft",
        statementCodes: [code],
        dryRun,
      });
      if (eqResult.status === "generated") {
        examQuestionsGenerated += eqResult.createdCount || 0;
      } else if (eqResult.status === "skipped") {
        duplicatesSkipped += 1;
      }
    } catch (e) {
      errors.push({ statementCode: code, message: e?.message || String(e) });
    }
  }

  return {
    topicKey: topicKeyResolved,
    specKey: normalized,
    dryRun: !!dryRun,
    skipped: false,
    statementsUsed: toProcess.length,
    flashcardsGenerated,
    examQuestionsGenerated,
    duplicatesSkipped,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Generate draft library for an entire spec.
 * Uses taxonomy leaf topics; skips topics with >100 flashcards or >40 exam questions.
 *
 * @param {Object} opts
 * @param {string} opts.specKey
 * @param {string[]} [opts.topicKeys]
 * @param {number} [opts.limitPerTopic]
 * @param {string} opts.adminUserId
 * @param {string} [opts.promptPackId]
 * @param {string} [opts.promptPackVersion]
 * @param {boolean} [opts.dryRun]
 */
async function generateDraftLibraryForSpec({
  specKey,
  topicKeys,
  limitPerTopic,
  adminUserId,
  promptPackId,
  promptPackVersion,
  limitFlashcards = DEFAULT_LIMIT_FLASHCARDS,
  limitExamQuestions = DEFAULT_LIMIT_EXAM_QUESTIONS,
  dryRun = false,
}) {
  if (!specKey || !adminUserId) {
    return {
      specKey: specKey || "",
      dryRun: !!dryRun,
      topicsProcessed: 0,
      flashcardsGenerated: 0,
      examQuestionsGenerated: 0,
      duplicatesSkipped: 0,
      skippedTopics: [],
      error: "specKey and adminUserId are required",
    };
  }

  const normalized = normalizeSpecKey(specKey);
  let targetTopics = topicKeys;

  if (!targetTopics || targetTopics.length === 0) {
    const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(normalized);
    if (!taxonomy || !Array.isArray(taxonomy.units)) {
      return {
        specKey: normalized,
        dryRun: !!dryRun,
        topicsProcessed: 0,
        flashcardsGenerated: 0,
        examQuestionsGenerated: 0,
        duplicatesSkipped: 0,
        skippedTopics: [],
        error: "Spec not found",
      };
    }
    const leafTopics = [];
    for (const unit of taxonomy.units) {
      for (const t of unit.topics || []) {
        const key = t.key || t.topicKey;
        if (!key) continue;
        const topicKey = key.includes(":") ? key : `${normalized}:${key}`;
        leafTopics.push(topicKey);
      }
    }
    targetTopics = leafTopics;
  }

  let topicsProcessed = 0;
  let totalFlashcards = 0;
  let totalExamQuestions = 0;
  let totalDuplicates = 0;
  const skippedTopics = [];
  const results = [];

  for (const topicKey of targetTopics) {
    const topicOnly = (topicKey || "").split(":").pop() || topicKey;
    const counts = await adminTaxonomyService.getLinkedContentCounts(normalized, topicOnly);
    if (counts.flashcards > 100 || counts.examQuestions > 40) {
      skippedTopics.push({
        topicKey,
        reason: counts.flashcards > 100 ? "flashcards_exceed_100" : "exam_questions_exceed_40",
      });
      continue;
    }

    const result = await generateDraftLibraryForTopic({
      specKey: normalized,
      topicKey,
      adminUserId,
      promptPackId,
      promptPackVersion,
      limitFlashcards,
      limitExamQuestions,
      limitPerTopic,
      dryRun,
    });

    if (result.skipped) {
      skippedTopics.push({ topicKey: result.topicKey, reason: result.reason });
      continue;
    }

    topicsProcessed += 1;
    totalFlashcards += result.flashcardsGenerated || 0;
    totalExamQuestions += result.examQuestionsGenerated || 0;
    totalDuplicates += result.duplicatesSkipped || 0;
    results.push(result);
  }

  return {
    specKey: normalized,
    dryRun: !!dryRun,
    topicsProcessed,
    flashcardsGenerated: totalFlashcards,
    examQuestionsGenerated: totalExamQuestions,
    duplicatesSkipped: totalDuplicates,
    skippedTopics,
    results,
  };
}

module.exports = {
  generateDraftLibraryForTopic,
  generateDraftLibraryForSpec,
  isLeafTopic,
};
