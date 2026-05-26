/**
 * Optional per-block learningMeta — shared with frontend/src/utils/learningMeta.ts
 */

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function safeTrim(v, maxLen) {
  const s = v === undefined || v === null ? "" : String(v).trim();
  if (!s) return undefined;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function sanitizeLearningMeta(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out = {};
  const concept = safeTrim(raw.concept, 500);
  const skill = safeTrim(raw.skill, 500);
  const misconceptionRisk = safeTrim(raw.misconceptionRisk, 500);
  const examSkill = safeTrim(raw.examSkill, 500);
  if (concept) out.concept = concept;
  if (skill) out.skill = skill;
  if (misconceptionRisk) out.misconceptionRisk = misconceptionRisk;
  if (examSkill) out.examSkill = examSkill;
  const dRaw = safeTrim(raw.difficulty, 20);
  if (dRaw && DIFFICULTIES.has(dRaw.toLowerCase())) {
    out.difficulty = dRaw.toLowerCase();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function attachLearningMetaToSanitisedBlock(sanitised, rawBlock) {
  if (!sanitised || typeof sanitised !== "object") return sanitised;
  const meta = sanitizeLearningMeta(rawBlock?.learningMeta);
  if (!meta) return sanitised;
  return { ...sanitised, learningMeta: meta };
}

function collectLearningMetaWarnings(pages) {
  const warnings = [];
  if (!Array.isArray(pages)) return warnings;
  pages.forEach((page, pageIndex) => {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    blocks.forEach((block, blockIndex) => {
      if (!block || typeof block !== "object") return;
      if (sanitizeLearningMeta(block.learningMeta)) return;
      const blockType = String(block.type ?? "text");
      warnings.push({
        pageIndex,
        blockIndex,
        blockType,
        message: `Page ${pageIndex + 1} block ${blockIndex + 1} (${blockType}): no learningMeta`,
      });
    });
  });
  return warnings;
}

module.exports = {
  sanitizeLearningMeta,
  attachLearningMetaToSanitisedBlock,
  collectLearningMetaWarnings,
};
