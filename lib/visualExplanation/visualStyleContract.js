/**
 * P1.3B — Let's Revise GCSE diagram visual style contract for image prompts.
 * Applied to every Visual Explanation image generation request.
 */

const VISUAL_STYLE_RULES = [
  "GCSE AQA Biology educational diagram",
  "Exam-ready revision diagram",
  "White background",
  "Clean black outlines",
  "Minimal colours only where they aid learning",
  "Large readable UPPERCASE labels",
  "Colour-coded arrows where useful to show direction or pathway",
  "No photorealism",
  "No 3D rendering",
  "No decorative infographic clutter",
  "No tiny text",
  "No watermark text inside the image",
  "Copyright-safe original diagram",
  "Simple classroom teaching clarity",
];

/**
 * @param {{ subject?: string; examBoard?: string }} [opts]
 * @returns {string}
 */
function buildVisualStyleContract(opts = {}) {
  const subject = String(opts.subject || "GCSE Biology").trim() || "GCSE Biology";
  const board = String(opts.examBoard || "AQA").trim() || "AQA";
  const rules = [
    `${board} ${subject} educational diagram`.replace(/\s+/g, " ").trim(),
    ...VISUAL_STYLE_RULES.slice(1),
  ];
  return `Let's Revise visual style: ${rules.join("; ")}.`;
}

module.exports = {
  VISUAL_STYLE_RULES,
  buildVisualStyleContract,
};
