/**
 * Teach → test rhythm validator (max 2 teach blocks before interaction).
 */

const {
  flattenPagesToBlocks,
  isTeachBlock,
  isInteractionBlock,
} = require("./lessonBlockAnalysis");

const MAX_CONSECUTIVE_TEACH = 2;

/**
 * @param {object[]|object} pagesOrBlocks
 * @returns {{ valid: boolean, violations: object[], maxConsecutiveTeach: number }}
 */
function validateTeachTestRhythm(pagesOrBlocks) {
  const blocks = Array.isArray(pagesOrBlocks) && pagesOrBlocks[0]?.blocks
    ? flattenPagesToBlocks(pagesOrBlocks)
    : pagesOrBlocks;

  const violations = [];
  let consecutiveTeach = 0;
  let maxConsecutiveTeach = 0;
  let teachRunStart = -1;

  blocks.forEach((block, index) => {
    const teach = isTeachBlock(block);
    const interact = isInteractionBlock(block);

    if (teach && !interact) {
      if (consecutiveTeach === 0) teachRunStart = index;
      consecutiveTeach++;
      maxConsecutiveTeach = Math.max(maxConsecutiveTeach, consecutiveTeach);
      if (consecutiveTeach > MAX_CONSECUTIVE_TEACH) {
        violations.push({
          kind: "consecutive_teach",
          blockIndex: index,
          teachRunStart,
          consecutiveTeach,
          message: `More than ${MAX_CONSECUTIVE_TEACH} teaching blocks before checkpoint/activity (index ${index})`,
        });
      }
    } else if (interact) {
      consecutiveTeach = 0;
      teachRunStart = -1;
    } else if (!teach) {
      consecutiveTeach = 0;
      teachRunStart = -1;
    }
  });

  return {
    valid: violations.length === 0,
    violations,
    maxConsecutiveTeach,
    maxAllowed: MAX_CONSECUTIVE_TEACH,
  };
}

module.exports = {
  MAX_CONSECUTIVE_TEACH,
  validateTeachTestRhythm,
};
