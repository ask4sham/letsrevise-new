/**
 * P3.0C — Generate Diagram Brief from lesson block.
 * Default OFF — set DIAGRAM_BRIEF_FROM_BLOCK=1 to enable routes/UI.
 */

function isDiagramBriefFromBlockEnabled() {
  return String(process.env.DIAGRAM_BRIEF_FROM_BLOCK || "0").trim() === "1";
}

module.exports = {
  isDiagramBriefFromBlockEnabled,
};
