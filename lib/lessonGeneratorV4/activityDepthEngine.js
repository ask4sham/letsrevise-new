/**
 * Activity depth engine — recall → understanding → application → exam thinking.
 */

const { flattenPagesToBlocks, blockHaystack } = require("./blockText");

const LEVEL_PATTERNS = {
  recall: [/define/, /name/, /identify/, /state/, /what is/],
  understanding: [/explain/, /describe/, /why/, /how does/],
  application: [/predict/, /apply/, /suggest/, /calculate/, /use your knowledge/],
  examThinking: [/evaluate/, /compare/, /justify/, /exam/, /mark scheme/, /6 mark/],
};

const ACTIVITY_TYPES = new Set([
  "dragdropmatch",
  "interactivesequence",
  "hotspot",
  "diagram",
  "graph",
  "checkpoint",
]);

/**
 * @param {object[]} pages
 */
function analyzeActivityDepth(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const activities = [];
  const gaps = [];

  blocks.forEach((block, index) => {
    const type = String(block.type || "").toLowerCase();
    if (!ACTIVITY_TYPES.has(type) && String(block.role || "").toLowerCase() !== "match") return;

    const hay = blockHaystack(block) || type;
    const hasActivityBlock = ACTIVITY_TYPES.has(type);
    const levels = {};
    for (const [level, patterns] of Object.entries(LEVEL_PATTERNS)) {
      levels[level] = patterns.some((re) => re.test(hay));
    }
    const depthScore =
      (levels.recall || hasActivityBlock ? 25 : 0) +
      (levels.understanding ? 30 : hasActivityBlock ? 15 : 0) +
      (levels.application ? 25 : 0) +
      (levels.examThinking ? 20 : 0);
    const recognitionOnly = levels.recall && !levels.understanding && !levels.application;

    activities.push({
      blockIndex: index,
      type,
      levels,
      depthScore,
      recognitionOnly,
      upgrade: recognitionOnly
        ? "Add explain/predict/justify prompt — not label-matching only"
        : null,
    });
  });

  const shallow = activities.filter((a) => a.recognitionOnly);
  if (activities.length && shallow.length === activities.length) {
    gaps.push("Activities only test recognition — add understanding/application");
  }
  if (!activities.some((a) => a.levels.examThinking)) {
    gaps.push("No activity at Level 4 (exam-style thinking)");
  }

  const avg =
    activities.length === 0
      ? 50
      : Math.round(activities.reduce((s, a) => s + a.depthScore, 0) / activities.length);

  return {
    activities,
    gaps,
    activityDepthScore: avg,
  };
}

module.exports = {
  analyzeActivityDepth,
  LEVEL_PATTERNS,
};
