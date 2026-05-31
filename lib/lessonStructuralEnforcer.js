/**
 * Structural enforcement pass — reorder blocks and insert placeholders (no content rewrite).
 */

const { MANDATORY_ARCHITECTURE_SEQUENCE, SLOT_META } = require("./lessonArchitectureEngine");
const {
  flattenPagesToBlocks,
  classifyBlockToArchitectureSlot,
  isTeachBlock,
  isInteractionBlock,
} = require("./lessonBlockAnalysis");
const { validateTeachTestRhythm } = require("./teachTestRhythmValidator");

function mapBlockToMandatorySlot(block, counters) {
  const base = classifyBlockToArchitectureSlot(block);
  if (base === "teachChunk") {
    counters.teach = (counters.teach || 0) + 1;
    return `teachChunk${Math.min(counters.teach, 4)}`;
  }
  if (base === "checkpoint") {
    counters.checkpoint = (counters.checkpoint || 0) + 1;
    return counters.checkpoint === 1 ? "checkpoint1" : "checkpoint";
  }
  if (MANDATORY_ARCHITECTURE_SEQUENCE.includes(base)) return base;
  if (base === "visualActivity" && !counters.visualUsed) {
    counters.visualUsed = true;
    return "visualActivity";
  }
  if (base === "interactiveActivity" && !counters.interactiveUsed) {
    counters.interactiveUsed = true;
    return "interactiveActivity";
  }
  return base;
}

function createPlaceholder(slot) {
  const meta = SLOT_META[slot] || {};
  const isCheckpoint = slot.startsWith("checkpoint");
  return {
    type: isCheckpoint ? "checkpoint" : "text",
    role: isCheckpoint ? "checkpoint" : "concept",
    title: isCheckpoint ? "CHECKPOINT" : String(slot).toUpperCase(),
    content: `<p><em>V3 structural placeholder — ${slot}. Teacher: add content.</em></p>`,
    _v3StructuralPlaceholder: true,
    _v3ArchitectureSlot: slot,
    _v3Phase: meta.phase || "learning",
  };
}

function slotOrderIndex(slot) {
  const idx = MANDATORY_ARCHITECTURE_SEQUENCE.indexOf(slot);
  return idx >= 0 ? idx : 100 + (slot === "unclassified" ? 50 : 0);
}

/**
 * Reorder blocks to mandatory architecture order; insert placeholders for gaps / rhythm.
 * @param {object[]} pages
 * @param {object} [blueprint]
 */
function enforceLessonStructure(pages, blueprint = null) {
  const page = Array.isArray(pages) && pages[0] ? { ...pages[0] } : { title: "Lesson", order: 1, blocks: [] };
  const original = flattenPagesToBlocks(pages);
  const counters = {};
  const buckets = Object.create(null);

  for (const slot of MANDATORY_ARCHITECTURE_SEQUENCE) {
    buckets[slot] = [];
  }
  buckets.unclassified = [];

  original.forEach((block) => {
    const slot = mapBlockToMandatorySlot(block, counters);
    const key = MANDATORY_ARCHITECTURE_SEQUENCE.includes(slot) ? slot : "unclassified";
    buckets[key].push({
      ...block,
      _v3ArchitectureSlot: block._v3ArchitectureSlot || slot,
    });
  });

  const foundationSlots = ["objectives", "priorKnowledge", "scenario", "coreRule"];
  for (const slot of foundationSlots) {
    if (buckets[slot].length === 0) {
      buckets[slot].push(createPlaceholder(slot));
    }
  }

  let ordered = [];
  for (const slot of MANDATORY_ARCHITECTURE_SEQUENCE) {
    ordered = ordered.concat(buckets[slot] || []);
  }
  ordered = ordered.concat(buckets.unclassified || []);

  const rhythmFixed = [];
  let teachRun = 0;
  for (let i = 0; i < ordered.length; i++) {
    const block = ordered[i];
    rhythmFixed.push(block);
    if (isTeachBlock(block) && !isInteractionBlock(block)) {
      teachRun++;
      if (teachRun > 2) {
        rhythmFixed.push(createPlaceholder("checkpoint1"));
        teachRun = 0;
      }
    } else if (isInteractionBlock(block)) {
      teachRun = 0;
    }
  }

  const rhythm = validateTeachTestRhythm(rhythmFixed);
  const changes = {
    reordered: true,
    placeholdersInserted: rhythmFixed.filter((b) => b._v3StructuralPlaceholder).length,
    originalBlockCount: original.length,
    finalBlockCount: rhythmFixed.length,
    rhythmValid: rhythm.valid,
  };

  return {
    pages: [{ ...page, blocks: rhythmFixed }],
    changes,
    blueprint,
  };
}

module.exports = {
  enforceLessonStructure,
  createPlaceholder,
};
