/**
 * Lesson architecture validator — run AFTER generation.
 */

const {
  flattenPagesToBlocks,
  classifyBlockToArchitectureSlot,
} = require("./lessonBlockAnalysis");
const { buildLessonArchitectureFromBlueprint } = require("./lessonArchitectureEngine");
const { validateTeachTestRhythm } = require("./teachTestRhythmValidator");

const FOUNDATION_REQUIRED = ["objectives", "priorKnowledge", "scenario", "coreRule"];
const LEARNING_REQUIRED_ANY = [
  ["teachChunk1", "teachChunk2", "teachChunk3", "teachChunk4"],
  ["checkpoint1", "checkpoint"],
  ["visualActivity", "interactiveActivity", "applicationActivity"],
];
const ENDGAME_REQUIRED = ["examTechnique", "examPractice", "summary", "keywords"];

function detectPresentSlots(blocks) {
  const present = new Set();
  const slotToIndices = Object.create(null);

  blocks.forEach((block, index) => {
    const base = classifyBlockToArchitectureSlot(block);
    present.add(base);
    if (!slotToIndices[base]) slotToIndices[base] = [];
    slotToIndices[base].push(index);

    if (base === "teachChunk") {
      const n = Object.keys(slotToIndices).filter((k) => k.startsWith("teachChunk")).length;
      const key = `teachChunk${n}`;
      present.add(key);
      if (!slotToIndices[key]) slotToIndices[key] = [];
      slotToIndices[key].push(index);
    }
    if (base === "checkpoint") {
      const n = Object.keys(slotToIndices).filter((k) => k.startsWith("checkpoint")).length;
      const key = n === 1 ? "checkpoint1" : `checkpoint${n}`;
      present.add(key);
      if (!slotToIndices[key]) slotToIndices[key] = [];
      slotToIndices[key].push(index);
    }
  });

  return { present, slotToIndices };
}

/**
 * @param {object[]} pages
 * @param {object} [blueprint]
 */
function validateLessonArchitecture(pages, blueprint = null) {
  const blocks = flattenPagesToBlocks(pages);
  const architecture = blueprint
    ? buildLessonArchitectureFromBlueprint(blueprint)
    : null;
  const { present, slotToIndices } = detectPresentSlots(blocks);
  const missingBlocks = [];
  const violations = [];

  for (const slot of FOUNDATION_REQUIRED) {
    if (!present.has(slot)) {
      missingBlocks.push({ slot, category: "foundation", required: true });
    }
  }

  const hasTeach =
    present.has("teachChunk") ||
    present.has("teachChunk1") ||
    present.has("teachChunk2") ||
    present.has("teachChunk3");
  const hasRetrieval = present.has("checkpoint") || present.has("checkpoint1");
  const hasApplication =
    present.has("visualActivity") ||
    present.has("interactiveActivity") ||
    present.has("applicationActivity");

  if (!hasTeach) missingBlocks.push({ slot: "teachChunk*", category: "learning", required: true });
  if (!hasRetrieval) missingBlocks.push({ slot: "checkpoint*", category: "learning", required: true });
  if (!hasApplication) {
    missingBlocks.push({ slot: "activity*", category: "learning", required: true });
  }

  for (const slot of ENDGAME_REQUIRED) {
    const alt = slot === "examTechnique" ? present.has("examTechnique") : present.has(slot);
    if (!alt && slot === "examPractice" && present.has("examPractice")) continue;
    if (!present.has(slot)) {
      missingBlocks.push({ slot, category: "endgame", required: true });
    }
  }

  const rhythm = validateTeachTestRhythm(blocks);
  if (!rhythm.valid) {
    violations.push(...rhythm.violations.map((v) => ({ ...v, category: "rhythm" })));
  }

  const architectureScore = scorePresence(
    FOUNDATION_REQUIRED.length +
      3 +
      ENDGAME_REQUIRED.length,
    missingBlocks.length
  );

  return {
    valid: missingBlocks.length === 0 && rhythm.valid,
    missingBlocks,
    violations,
    rhythm,
    presentSlots: [...present],
    slotToIndices,
    architecture,
    architectureScore,
  };
}

function scorePresence(total, missing) {
  if (total <= 0) return 100;
  return Math.max(0, Math.round(100 * (1 - missing / total)));
}

module.exports = {
  FOUNDATION_REQUIRED,
  ENDGAME_REQUIRED,
  validateLessonArchitecture,
  detectPresentSlots,
};
