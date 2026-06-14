/**
 * P1 Visual Explanation feature flag.
 * Default OFF — set VISUAL_EXPLANATION_ENABLED=1 to enable.
 */

function isVisualExplanationEnabled() {
  return String(process.env.VISUAL_EXPLANATION_ENABLED || "0").trim() === "1";
}

module.exports = {
  isVisualExplanationEnabled,
};
