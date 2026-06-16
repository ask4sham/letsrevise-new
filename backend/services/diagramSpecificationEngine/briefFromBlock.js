/**
 * P3.0C — Lesson block → DiagramSpecification → composed brief.
 */
const { composeDiagramBrief } = require("./briefComposer");
const { lessonBlockToDiagramSpec } = require("./lessonBlockToSpec");

/**
 * @param {object} input
 * @param {object} input.block
 * @param {object} [input.lesson]
 * @param {object} [input.page]
 * @param {object} [input.options]
 */
function composeDiagramBriefFromBlock(input = {}) {
  const mapped = lessonBlockToDiagramSpec(input.block, input.lesson || {}, input.page || {});
  if (!mapped.ok || !mapped.spec) {
    return {
      ok: false,
      brief: "",
      teacherMetadata: null,
      spec: null,
      errors: mapped.errors || [{ path: "block", message: "Could not map block to specification", code: "MAP_FAILED" }],
      warnings: [],
      metadata: null,
    };
  }

  const composed = composeDiagramBrief(mapped.spec, input.options || {});
  return {
    ...composed,
    spec: mapped.spec,
  };
}

module.exports = {
  composeDiagramBriefFromBlock,
};
