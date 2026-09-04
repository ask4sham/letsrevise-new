/**
 * Curriculum Autopilot — thin wrappers around existing generation flows.
 * Generated content defaults to draft; metadata.generatedBy = "autopilot".
 * Stubs cleanly when generation is not available (e.g. no SpecStatements).
 */
const crypto = require("crypto");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const { runStarterPackGeneration } = require("./generation/starterPackService");
const { fingerprint: flashcardFingerprint } = require("../utils/flashcardDedupe");
const { fingerprintItem: quizFingerprintItem } = require("../utils/quizDedupe");
const { examQuestionFingerprint } = require("../utils/examQuestionDedupe");
const { filterBankItemsByDrift } = require("../utils/topicDriftValidation");
const { parseTopicKey } = require("../utils/topicKey");
const { normalizeSpecKey } = require("../config/featureFlags");
const { buildAutopilotPromptMetadata } = require("./autopilotPromptMetadata");
const { scoreFlashcardDraft, scoreQuizMcqDraft, scoreExamDraft, metadataQualityPatch } = require("../utils/draftQualityScoring");
const { persistGeneratedExamQuestionBatch } = require("../utils/examQuestionGeneratedMarkSchemeRecovery");
const adminTaxonomyService = require("./adminTaxonomyService");

function parseSpecToMeta(specKey) {
  const parts = (specKey || "").split("-").filter(Boolean);
  if (parts.length >= 3) {
    return {
      examBoard: (parts[0] || "AQA").toUpperCase(),
      level: (parts[1] || "GCSE").toUpperCase(),
      subject: (parts[2] || "Biology").charAt(0).toUpperCase() + (parts[2] || "").slice(1).toLowerCase(),
    };
  }
  return { examBoard: "AQA", level: "GCSE", subject: "Biology" };
}

function topicDisplayName(topicKey) {
  const last = (topicKey || "").split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey || "Topic";
}

/**
 * Run starter pack generation once. Returns pack or null if not available.
 * @private
 * @param {string} specKey
 * @param {string} topicKey
 * @param {string} adminUserId
 * @param {string[]} [statementCodes] - Optional; when provided, generate for these statements only.
 * @param {string} [sourceType] - When "spec_statements_only", uses ONLY SpecStatements (copyright-safe).
 */
async function _getStarterPack(specKey, topicKey, adminUserId, statementCodes, sourceType) {
  const normalized = normalizeSpecKey(specKey);
  const topic = (topicKey || "").includes(":") ? topicKey : `${normalized}:${(topicKey || "").trim()}`;
  const seed = crypto.createHash("sha256").update(`autopilot|${topic}|${Date.now()}`).digest("hex").slice(0, 16);
  try {
    const { pack } = await runStarterPackGeneration({
      specKey: normalized,
      topicKey: topic,
      statementCodes: statementCodes && statementCodes.length > 0 ? statementCodes : undefined,
      tier: null,
      seed,
      user: { _id: adminUserId },
      sourceType,
    });
    return pack;
  } catch (e) {
    if (e.message && e.message.includes("No spec statements")) {
      return null;
    }
    throw e;
  }
}

/**
 * Generate flashcards for topic. Uses starter pack; saves as draft or published per initialStatus.
 * @param {{ specKey, topicKey, count?, adminUserId, promptPack?, initialStatus?, statementCodes?, dryRun? }}
 */
async function generateFlashcardsForTopic({ specKey, topicKey, count = 5, adminUserId, promptPack, initialStatus = "draft", statementCodes, dryRun }) {
  if (!adminUserId) return { status: "skipped", reason: "adminUserId required" };
  const normalizedPre = normalizeSpecKey(specKey);
  const topicForGroup = (topicKey || "").includes(":") ? topicKey : `${normalizedPre}:${(topicKey || "").trim()}`;
  if (await adminTaxonomyService.topicIsGroupInMerged(normalizedPre, topicForGroup)) {
    return { status: "skipped", reason: "topic_is_group" };
  }
  const sourceType = promptPack?.generatorMode === "draft_library" ? "spec_statements_only" : undefined;
  const pack = await _getStarterPack(specKey, topicKey, adminUserId, statementCodes, sourceType);
  if (!pack || !Array.isArray(pack.flashcards) || pack.flashcards.length === 0) {
    return { status: "skipped", reason: "generation_not_available" };
  }
  const normalized = normalizeSpecKey(specKey);
  const topic = (topicKey || "").includes(":") ? topicKey : `${normalized}:${(topicKey || "").trim()}`;
  const meta = parseSpecToMeta(normalized);
  const topicDisplay = topicDisplayName(topic);
  const specKeyForDrift = parseTopicKey(topic).specKey || normalized;
  const topicKeyShort = parseTopicKey(topic).topicKey || topic;
  const filtered = filterBankItemsByDrift({
    topicKey: topicKeyShort,
    specKey: specKeyForDrift,
    subTopicLabel: topicDisplay,
    flashcards: pack.flashcards,
    quizItems: [],
    examQuestions: [],
  });
  const toSave = (filtered.flashcards || []).slice(0, count);
  const promptMeta = buildAutopilotPromptMetadata({
    contentType: "flashcard",
    specKey: normalized,
    topicKey: topic,
    generatorMode: promptPack?.generatorMode,
    promptPack,
  });
  const generatedFrom = {
    generatedBy: "autopilot",
    specKey: normalized,
    topicKey: topic,
    generatedAt: new Date(),
    ...promptMeta,
  };
  if (promptPack?.sourceType) generatedFrom.sourceType = promptPack.sourceType;
  const ids = [];
  for (const f of toSave) {
    const front = (f.front || "").trim().slice(0, 500);
    const back = (f.back || "").trim().slice(0, 2000);
    if (!front || !back) continue;
    const fp = flashcardFingerprint(front, back);
    if (dryRun) {
      ids.push(`dry-run-${fp.slice(0, 8)}`);
      continue;
    }
    const doc = new TopicFlashcard({
      ownerId: adminUserId,
      subject: meta.subject,
      examBoard: meta.examBoard,
      level: meta.level,
      topicKey: topic,
      topic: topicDisplay,
      front,
      back,
      status: initialStatus === "published" ? "published" : "draft",
      fingerprint: fp,
      metadata: {
        ...generatedFrom,
        ...metadataQualityPatch(scoreFlashcardDraft({ front, back }), "heuristic"),
      },
    });
    await doc.save();
    ids.push(String(doc._id));
  }
  return { status: "generated", createdCount: ids.length, ids, dryRun: !!dryRun };
}

/**
 * Generate quiz questions for topic. Uses starter pack; saves as draft or published per initialStatus.
 * @param {{ specKey, topicKey, count?, adminUserId, promptPack? }}
 */
async function generateQuizForTopic({ specKey, topicKey, count = 3, adminUserId, promptPack, initialStatus = "draft" }) {
  if (!adminUserId) return { status: "skipped", reason: "adminUserId required" };
  const normalizedPre = normalizeSpecKey(specKey);
  const topicForGroup = (topicKey || "").includes(":") ? topicKey : `${normalizedPre}:${(topicKey || "").trim()}`;
  if (await adminTaxonomyService.topicIsGroupInMerged(normalizedPre, topicForGroup)) {
    return { status: "skipped", reason: "topic_is_group" };
  }
  const pack = await _getStarterPack(specKey, topicKey, adminUserId);
  const quizItems = pack?.quiz || [];
  if (!pack || quizItems.length === 0) {
    return { status: "skipped", reason: "generation_not_available" };
  }
  const normalized = normalizeSpecKey(specKey);
  const topic = (topicKey || "").includes(":") ? topicKey : `${normalized}:${(topicKey || "").trim()}`;
  const specKeyForDrift = parseTopicKey(topic).specKey || normalized;
  const topicKeyShort = parseTopicKey(topic).topicKey || topic;
  const topicDisplay = topicDisplayName(topic);
  const filtered = filterBankItemsByDrift({
    topicKey: topicKeyShort,
    specKey: specKeyForDrift,
    subTopicLabel: topicDisplay,
    flashcards: [],
    quizItems,
    examQuestions: [],
  });
  const toSave = (filtered.quizItems || []).slice(0, count);
  const promptMeta = buildAutopilotPromptMetadata({
    contentType: "quizQuestion",
    specKey: normalized,
    topicKey: topic,
    generatorMode: promptPack?.generatorMode,
    promptPack,
  });
  const ids = [];
  for (const q of toSave) {
    const questionText = (q.question || "").trim();
    const choices = Array.isArray(q.options) ? q.options.map((x) => String(x).trim()) : [];
    const correctIndex = Math.min(Math.max(0, Number(q.correctIndex) || 0), Math.max(0, choices.length - 1));
    if (!questionText) continue;
    const item = { questionText, choices, correctIndex, type: "mcq", kind: q.kind || "quiz" };
    const fp = quizFingerprintItem(item);
    const doc = new TopicQuizQuestion({
      ownerId: adminUserId,
      topicKey: topic,
      specKey: normalized,
      questionText,
      choices,
      correctIndex,
      explanation: (q.explanation || "").trim().slice(0, 1000),
      type: "mcq",
      kind: q.kind || "quiz",
      status: initialStatus === "published" ? "published" : "draft",
      fingerprint: fp,
      metadata: { generatedBy: "autopilot", specKey: normalized, topicKey: topic, ...promptMeta },
    });
    await doc.save();
    ids.push(String(doc._id));
  }
  return { status: "generated", createdCount: ids.length, ids };
}

/**
 * Generate exam questions for topic. Uses starter pack; saves as draft or published per initialStatus.
 * @param {{ specKey, topicKey, count?, adminUserId, promptPack?, initialStatus?, statementCodes?, dryRun? }}
 */
async function generateExamQuestionsForTopic({ specKey, topicKey, count = 10, adminUserId, promptPack, initialStatus = "draft", statementCodes, dryRun }) {
  if (!adminUserId) return { status: "skipped", reason: "adminUserId required" };
  const normalizedPre = normalizeSpecKey(specKey);
  const topicForGroup = (topicKey || "").includes(":") ? topicKey : `${normalizedPre}:${(topicKey || "").trim()}`;
  if (await adminTaxonomyService.topicIsGroupInMerged(normalizedPre, topicForGroup)) {
    return { status: "skipped", reason: "topic_is_group" };
  }
  const sourceType = promptPack?.generatorMode === "draft_library" ? "spec_statements_only" : undefined;
  const pack = await _getStarterPack(specKey, topicKey, adminUserId, statementCodes, sourceType);
  const examQuestions = pack?.examQuestions || [];
  if (!pack || examQuestions.length === 0) {
    return { status: "skipped", reason: "generation_not_available" };
  }
  const normalizedSpecKey = normalizeSpecKey(specKey);
  const topic = (topicKey || "").includes(":") ? topicKey : `${normalizedSpecKey}:${(topicKey || "").trim()}`;
  const meta = parseSpecToMeta(normalizedSpecKey);
  const topicDisplay = topicDisplayName(topic);
  const specKeyForDrift = parseTopicKey(topic).specKey || normalizedSpecKey;
  const topicKeyShort = parseTopicKey(topic).topicKey || topic;
  const filtered = filterBankItemsByDrift({
    topicKey: topicKeyShort,
    specKey: specKeyForDrift,
    subTopicLabel: topicDisplay,
    flashcards: [],
    quizItems: [],
    examQuestions,
  });
  const toSave = (filtered.examQuestions || []).slice(0, count);
  const promptMeta = buildAutopilotPromptMetadata({
    contentType: "examQuestion",
    specKey: normalizedSpecKey,
    topicKey: topic,
    generatorMode: promptPack?.generatorMode,
    promptPack,
  });
  const generatedFrom = {
    generatedBy: "autopilot",
    specKey: normalizedSpecKey,
    topicKey: topic,
    generatedAt: new Date(),
    ...promptMeta,
  };
  if (promptPack?.sourceType) generatedFrom.sourceType = promptPack.sourceType;
  const ids = [];
  if (dryRun) {
    for (const eq of toSave) {
      const { resolveGeneratedExamQuestionForBank } = require("../utils/examQuestionGeneratedMarkSchemeRecovery");
      const resolved = await resolveGeneratedExamQuestionForBank(eq, { allowCorrectiveRetry: false });
      if (!resolved.ok) continue;
      const { question, marks, markScheme, modelAnswer } = resolved.normalized;
      const msJoin = [...(markScheme || []), modelAnswer].filter(Boolean).join("\n");
      const fp = examQuestionFingerprint({ specKey: normalizedSpecKey, topicKey: topic, question, markScheme: msJoin, marks });
      ids.push(`dry-run-${fp.slice(0, 8)}`);
    }
    return { status: "generated", createdCount: ids.length, ids, dryRun: true };
  }

  const examBatch = await persistGeneratedExamQuestionBatch({
    items: toSave,
    expectedCount: count,
    persist: async (normalized) => {
      const { question, marks, markScheme, modelAnswer } = normalized;
      const msJoin = [...(markScheme || []), modelAnswer].filter(Boolean).join("\n");
      const fp = examQuestionFingerprint({ specKey: normalizedSpecKey, topicKey: topic, question, markScheme: msJoin, marks });
      const doc = new ExamQuestion({
        teacherId: adminUserId,
        subject: meta.subject,
        examBoard: meta.examBoard,
        level: meta.level,
        topic: topicDisplay,
        topicKey: topic,
        type: "short",
        marks,
        question,
        markScheme,
        correctAnswer: modelAnswer,
        status: initialStatus === "published" ? "published" : "draft",
        fingerprint: fp,
        metadata: {
          ...generatedFrom,
          modelAnswer,
          ...metadataQualityPatch(
            scoreExamDraft({
              question,
              marks,
              markScheme,
              type: "short",
              modelAnswer,
            }),
            "heuristic"
          ),
        },
      });
      await doc.save();
      return doc._id;
    },
  });

  if (!examBatch.complete) {
    return {
      status: "failed",
      code: examBatch.error.code,
      reason: examBatch.error.message,
      createdCount: examBatch.persistedCount,
      ids: examBatch.persisted.map((p) => String(p.id)),
      incomplete: true,
    };
  }

  for (const row of examBatch.persisted) {
    ids.push(String(row.id));
  }
  return { status: "generated", createdCount: ids.length, ids, dryRun: false };
}

module.exports = {
  generateFlashcardsForTopic,
  generateQuizForTopic,
  generateExamQuestionsForTopic,
};
