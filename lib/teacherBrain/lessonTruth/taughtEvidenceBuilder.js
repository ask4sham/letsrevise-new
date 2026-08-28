/**
 * Build traceable taughtEvidence from lesson pages/blocks.
 *
 * Teaching-authority blocks (objectives, definition, core model, teach chunks,
 * key ideas, worked examples) contribute evidence. Assessment-only blocks
 * (checkpoint, selfcheck, examPractice) are skipped — they must not define
 * what was taught.
 */

const { classifyBlockToArchitectureSlot } = require("../../lessonBlockAnalysis");
const {
  blockToPlainText,
  extractBoldTerms,
  extractBoldTermDefinitions,
  extractTermDefinitionPairs,
  extractMisconceptionLines,
  safeStr,
} = require("../briefs/lessonContentExtractor");
const { createConceptRef, normalizeConceptId, dedupeConceptRefs } = require("./conceptNormalization");

const ASSESSMENT_ONLY_SLOTS = new Set(["checkpoint", "examPractice", "revisionPractice"]);
const ASSESSMENT_ONLY_TYPES = new Set([
  "checkpoint",
  "self-check-question",
  "selfcheck",
  "pagequiz",
  "page-quiz",
  "examquestion",
]);

/** Endgame / non-instructional slots — never teaching authority. */
const NON_TEACHING_SLOTS = new Set([
  "summary",
  "keywords",
  "examTechnique",
  "checkpoint",
  "examPractice",
  "revisionPractice",
  "interactiveActivity",
  "visualActivity",
  "applicationActivity",
  "unclassified",
]);

const HIGH_AUTHORITY_SLOTS = new Set([
  "objectives",
  "definition",
  "coreModel",
  "keyExamples",
  "examVocabulary",
  "coreRule",
  "whyItMatters",
  "priorKnowledge",
]);

const TRUSTED_TEACHING_ROLES = new Set(["lessonobjectives", "concept", "corerule", "definition", "coremodel"]);
const INSTRUCTIONAL_TEXT_TYPES = new Set(["text", "text-concept", "objectives", "keyidea", "worked-example"]);

const SUMMARY_MAX = 160;

const GENERIC_BLOCK_TITLES = new Set([
  "definition",
  "lesson objectives",
  "revision objectives",
  "prior knowledge",
  "core model",
  "key examples",
  "exam vocabulary",
  "summary",
  "key words",
  "scenario",
  "core rule",
  "exam technique",
  "exam practice",
  "quick check",
  "checkpoint",
]);

/**
 * @param {object} block
 * @returns {boolean}
 */
function isTeachingAuthorityBlock(block) {
  if (!block || typeof block !== "object") return false;
  const slot = classifyBlockToArchitectureSlot(block);
  const type = safeStr(block.type).toLowerCase();
  const role = safeStr(block.role).toLowerCase();

  if (ASSESSMENT_ONLY_SLOTS.has(slot)) return false;
  if (ASSESSMENT_ONLY_TYPES.has(type)) return false;
  if (NON_TEACHING_SLOTS.has(slot)) return false;
  if (type === "keywords") return false;
  if (role === "checkpoint" || role === "quickcheck" || role === "exampractice") return false;
  if (role === "summary" || role === "keywords" || role === "examtechnique") return false;

  if (HIGH_AUTHORITY_SLOTS.has(slot)) return true;
  if (type === "keyidea" || type === "worked-example" || type === "objectives") return true;
  if (slot === "teachChunk" && TRUSTED_TEACHING_ROLES.has(role) && INSTRUCTIONAL_TEXT_TYPES.has(type)) {
    return true;
  }
  if (TRUSTED_TEACHING_ROLES.has(role) && INSTRUCTIONAL_TEXT_TYPES.has(type)) return true;

  return false;
}

/**
 * @param {string} plain
 * @returns {string}
 */
function boundedSummary(plain) {
  const text = safeStr(plain).replace(/\s+/g, " ");
  if (text.length <= SUMMARY_MAX) return text;
  return `${text.slice(0, SUMMARY_MAX - 1).trim()}…`;
}

/**
 * Extract concept refs from teaching block plain text.
 * @param {string} plain
 * @param {string} [title]
 * @returns {import("./types").ConceptRef[]}
 */
function extractConceptRefsFromText(plain, title) {
  const refs = [];
  const seen = new Set();

  const addRef = (term) => {
    const t = safeStr(term);
    if (!t || t.split(/\s+/).length > 8) return;
    const ref = createConceptRef(t);
    if (seen.has(ref.id)) return;
    seen.add(ref.id);
    refs.push(ref);
  };

  if (title && !GENERIC_BLOCK_TITLES.has(safeStr(title).toLowerCase())) {
    addRef(title);
  }

  for (const pair of extractTermDefinitionPairs(plain)) addRef(pair.term);
  for (const pair of extractBoldTermDefinitions(plain)) addRef(pair.term);
  for (const term of extractBoldTerms(plain)) addRef(term);

  return refs;
}

/**
 * @param {number} pageIndex
 * @param {number} blockIndex
 * @param {object} block
 * @returns {string}
 */
function buildEvidenceId(pageIndex, blockIndex, block) {
  const blockKey = safeStr(block.id) || safeStr(block._id) || `p${pageIndex}b${blockIndex}`;
  return `ev-${pageIndex}-${normalizeConceptId(blockKey)}`;
}

/**
 * @param {object} lesson
 * @param {import("./types").LearningObjective[]} learningObjectives
 * @returns {{ taughtEvidence: import("./types").TaughtEvidence[], teachConceptRefs: import("./types").ConceptRef[], misconceptions: import("./types").MisconceptionRecord[], vocabulary: string[] }}
 */
function buildTaughtEvidence(lesson, learningObjectives = []) {
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  const taughtEvidence = [];
  const teachConceptRefs = [];
  const misconceptionLines = [];
  const vocabulary = new Set();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
      const block = blocks[blockIndex];
      if (!isTeachingAuthorityBlock(block)) continue;

      const plain = blockToPlainText(block);
      if (!plain) continue;

      const blockConceptRefs = extractConceptRefsFromText(plain, block.title);
      if (!blockConceptRefs.length && !block.title) continue;

      for (const ref of blockConceptRefs) {
        teachConceptRefs.push(ref);
        for (const term of ref.matchTerms || []) vocabulary.add(term);
        vocabulary.add(ref.name);
      }

      const objectiveIds = learningObjectives
        .filter((obj) => {
          const hay = `${obj.text} ${(obj.matchTerms || []).join(" ")}`.toLowerCase();
          return blockConceptRefs.some((ref) =>
            (ref.matchTerms || []).some((term) => term && hay.includes(term))
          );
        })
        .map((obj) => obj.objectiveId);

      taughtEvidence.push({
        evidenceId: buildEvidenceId(pageIndex, blockIndex, block),
        pageIndex,
        blockId: safeStr(block.id) || safeStr(block._id) || `p${pageIndex}b${blockIndex}`,
        blockRole: safeStr(block.role),
        blockType: safeStr(block.type),
        conceptIds: blockConceptRefs.map((r) => r.id),
        objectiveIds: [...new Set(objectiveIds)].sort(),
        summary: boundedSummary(plain),
        matchTerms: blockConceptRefs.flatMap((r) => r.matchTerms || []).sort(),
      });

      const blockType = safeStr(block.type).toLowerCase();
      const blockRole = safeStr(block.role).toLowerCase();
      if (blockType === "commonmistake" || blockRole === "commonmistake") {
        for (const line of extractMisconceptionLines(plain)) {
          misconceptionLines.push(line);
        }
      }
    }
  }

  const misconceptions = [...new Set(misconceptionLines)].map((text, i) => ({
    id: `misconception-${i + 1}`,
    text,
    conceptIds: [],
  }));

  return {
    taughtEvidence,
    teachConceptRefs: dedupeConceptRefs(teachConceptRefs),
    misconceptions,
    vocabulary: [...vocabulary].filter(Boolean).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  };
}

module.exports = {
  isTeachingAuthorityBlock,
  buildTaughtEvidence,
  extractConceptRefsFromText,
  ASSESSMENT_ONLY_SLOTS,
  ASSESSMENT_ONLY_TYPES,
  NON_TEACHING_SLOTS,
  HIGH_AUTHORITY_SLOTS,
  TRUSTED_TEACHING_ROLES,
  INSTRUCTIONAL_TEXT_TYPES,
  GENERIC_BLOCK_TITLES,
};
