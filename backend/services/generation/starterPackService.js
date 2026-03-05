/**
 * PR-014: Starter pack generation — spec statements + knowledge retrieval + LLM.
 * Uses ONLY trusted internal sources.
 */
const crypto = require("crypto");
const SpecStatement = require("../../models/SpecStatement");
const KnowledgeDocument = require("../../models/KnowledgeDocument");
const { searchKnowledge } = require("../knowledge/knowledgeSearchService");
const { generateStarterPack } = require("../llm/provider");
const { normalizeSpecKey } = require("../../config/featureFlags");

function getSpecVariants(specKey) {
  const normalized = normalizeSpecKey(specKey);
  const withUnderscores = normalized.replace(/-/g, "_");
  return [...new Set([normalized, withUnderscores])];
}

/**
 * Get missing statement codes for topic (SpecStatements without KnowledgeDocument).
 */
async function getMissingStatementCodes(specKey, topicKey) {
  const specVariants = getSpecVariants(specKey);
  const specStatements = await SpecStatement.find({
    specKey: { $in: specVariants },
    topicKey,
  })
    .select("statementCode")
    .lean();

  const coveredCodes = await KnowledgeDocument.distinct("metadata.statementCode", {
    sourceType: "specStatement",
    specKey: { $in: specVariants },
    topicKey,
    "metadata.statementCode": { $exists: true, $ne: "" },
  });
  const coveredSet = new Set(coveredCodes.map((c) => String(c).trim()).filter(Boolean));

  return specStatements
    .filter((s) => !coveredSet.has(String(s.statementCode || "").trim()))
    .map((s) => s.statementCode)
    .filter(Boolean)
    .slice(0, 5);
}

/**
 * Load SpecStatements by codes (or all for topic if codes empty).
 */
async function loadStatements(specKey, topicKey, statementCodes) {
  const specVariants = getSpecVariants(specKey);
  const query = { specKey: { $in: specVariants }, topicKey };
  if (statementCodes && statementCodes.length > 0) {
    query.statementCode = { $in: statementCodes };
  }
  return SpecStatement.find(query).select("statementCode statementText tier tags").lean();
}

/**
 * Retrieve context chunks from KnowledgeDocuments.
 */
async function retrieveContext(specKey, topicKey, statements) {
  const keywords = (statements || [])
    .map((s) => (s.statementText || "").slice(0, 100))
    .filter(Boolean)
    .join(" ");
  const topicPart = (topicKey || "").split(":").pop() || topicKey || "";
  const query = `${topicPart} ${keywords}`.trim() || topicKey;
  if (!query) return [];

  try {
    const chunks = await searchKnowledge({
      query,
      specKey,
      topicKey,
      limit: 12,
      topK: 30,
    });
    return chunks;
  } catch (e) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[starterPack] searchKnowledge failed:", e.message);
    }
    return [];
  }
}

/**
 * Generate starter pack. Returns parsed JSON or throws.
 */
async function runStarterPackGeneration({ specKey, topicKey, statementCodes, tier, seed, user }) {
  const normalized = normalizeSpecKey(specKey);
  const codes = statementCodes && statementCodes.length > 0
    ? statementCodes
    : await getMissingStatementCodes(normalized, topicKey);

  const statements = await loadStatements(normalized, topicKey, codes);
  if (statements.length === 0) {
    throw new Error("No spec statements found for this topic. Add SpecStatements first.");
  }

  const contextChunks = await retrieveContext(normalized, topicKey, statements);
  const effectiveCodes = codes.length > 0 ? codes : statements.map((s) => s.statementCode).filter(Boolean);

  const pack = await generateStarterPack({
    specKey: normalized,
    topicKey,
    statementCodes: effectiveCodes,
    statements,
    contextChunks,
    seed,
  });

  return {
    pack,
    statements,
    contextChunks,
    warnings: contextChunks.length < 4 ? ["Limited context retrieved; output may be generic."] : [],
  };
}

module.exports = {
  runStarterPackGeneration,
  getMissingStatementCodes,
  loadStatements,
  retrieveContext,
};
