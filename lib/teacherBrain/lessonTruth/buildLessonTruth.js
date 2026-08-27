/**
 * Build deterministic Lesson Truth from a lesson document (Phase 1).
 *
 * No persistence, DB, API, LLM, or generator consumption.
 */

const { resolveSubTopicProfile } = require("../subTopicProfiles");
const { canonicalizeSemantic, hashSemantic, hashLessonInput } = require("./canonicalize");
const { safeStr } = require("./conceptNormalization");
const { extractLearningObjectives, deriveConceptAuthority } = require("./requiredConceptsFromLesson");
const { buildTaughtEvidence } = require("./taughtEvidenceBuilder");

const BUILDER_VERSION = "lesson-truth-v1.0.0";
const SEMANTIC_VERSION = "1.0.0";

/**
 * Normalize lesson fields relevant to truth building (for inputContentHash).
 * @param {object} lesson
 * @returns {object}
 */
function normalizeLessonInput(lesson) {
  const pages = (Array.isArray(lesson?.pages) ? lesson.pages : []).map((page, pageIndex) => ({
    pageIndex,
    blocks: (Array.isArray(page?.blocks) ? page.blocks : []).map((block, blockIndex) => ({
      blockIndex,
      id: safeStr(block?.id) || safeStr(block?._id) || null,
      type: safeStr(block?.type),
      role: safeStr(block?.role),
      title: safeStr(block?.title),
      content: safeStr(block?.content),
      text: safeStr(block?.text),
      body: safeStr(block?.body),
      question: safeStr(block?.question),
      keyIdea: safeStr(block?.keyIdea),
      keywords: Array.isArray(block?.keywords) ? [...block.keywords].map(safeStr).sort() : [],
      keyWords: Array.isArray(block?.keyWords) ? [...block.keyWords].map(safeStr).sort() : [],
    })),
  }));

  return {
    title: safeStr(lesson?.title || lesson?.name),
    subject: safeStr(lesson?.subject),
    level: safeStr(lesson?.level),
    examBoard: safeStr(lesson?.examBoard),
    tier: safeStr(lesson?.tier),
    topicKey: safeStr(lesson?.topicKey),
    specKey: safeStr(lesson?.specKey),
    subTopic: safeStr(lesson?.subTopic),
    topic: safeStr(lesson?.topic),
    learningObjectives: Array.isArray(lesson?.learningObjectives)
      ? lesson.learningObjectives.map((o) => (typeof o === "string" ? o : safeStr(o?.text)))
      : [],
    objectives: Array.isArray(lesson?.objectives)
      ? lesson.objectives.map((o) => (typeof o === "string" ? o : safeStr(o?.text)))
      : [],
    walt: safeStr(lesson?.walt),
    wilf: safeStr(lesson?.wilf),
    successCriteria: Array.isArray(lesson?.successCriteria)
      ? lesson.successCriteria.map(safeStr)
      : [],
    pages,
  };
}

/**
 * @param {object} lesson Lesson document (pages/blocks)
 * @param {object} [options]
 * @param {string} [options.topicProfileKey]
 * @param {string} [options.generatedAt] Override for tests only
 * @returns {import("./types").LessonTruthEnvelope}
 */
function buildLessonTruth(lesson, options = {}) {
  if (!lesson || typeof lesson !== "object") {
    throw new TypeError("buildLessonTruth requires a lesson object");
  }

  const normalizedInput = normalizeLessonInput(lesson);
  const learningObjectives = extractLearningObjectives(lesson);
  const { taughtEvidence, teachConceptRefs, misconceptions, vocabulary } = buildTaughtEvidence(
    lesson,
    learningObjectives
  );

  const profile = resolveSubTopicProfile({
    topicKey: lesson.topicKey,
    subTopic: lesson.subTopic,
    topic: lesson.topic || lesson.title,
  });

  const {
    requiredConcepts,
    supportingConcepts,
    outOfScopeConcepts,
    assessmentExclusions,
    authorityConflicts,
  } = deriveConceptAuthority({
    lesson,
    learningObjectives,
    taughtEvidence,
    teachConceptRefs,
    profile,
  });

  const semanticRaw = {
    version: SEMANTIC_VERSION,
    lessonTitle: safeStr(lesson.title || lesson.name),
    subject: safeStr(lesson.subject),
    level: safeStr(lesson.level),
    examBoard: safeStr(lesson.examBoard),
    tier: safeStr(lesson.tier),
    topicKey: safeStr(lesson.topicKey),
    specKey: safeStr(lesson.specKey),
    learningObjectives,
    requiredConcepts,
    supportingConcepts,
    outOfScopeConcepts,
    assessmentExclusions,
    misconceptions,
    vocabulary,
    taughtEvidence,
    assessmentTargets: [],
    authorityConflicts,
  };

  const semantic = canonicalizeSemantic(semanticRaw);
  const contentHash = hashSemantic(semantic);
  const inputContentHash = hashLessonInput(normalizedInput);

  return {
    semantic,
    meta: {
      generatedAt: options.generatedAt || new Date().toISOString(),
      builderVersion: BUILDER_VERSION,
      contentHash,
      inputContentHash,
      subTopicProfileKey: profile?.taxonomyKey || null,
      topicProfileKey: options.topicProfileKey || null,
      targetsDeferred: true,
    },
  };
}

module.exports = {
  BUILDER_VERSION,
  SEMANTIC_VERSION,
  normalizeLessonInput,
  buildLessonTruth,
};
