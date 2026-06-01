/**
 * Drag-drop activity image design contract — prompt text for Teacher Brain / generators.
 * Source of truth: docs/design/DRAG_DROP_VISUAL_CONTRACT.md
 * Phase 2: prompts only — does not affect renderer, CSS, or lesson payloads.
 */

const IMAGE_DESIGN_REQUIREMENTS_HEADING = "IMAGE DESIGN REQUIREMENTS";

/**
 * @param {Array<{ prompt?: string, answer?: string }>} [pairs]
 * @returns {string}
 */
function formatDropZoneAlignmentLines(pairs) {
  const letters = ["A", "B", "C", "D"];
  const usable = Array.isArray(pairs)
    ? pairs.filter((p) => p && String(p.prompt || p.answer || "").trim()).slice(0, 4)
    : [];
  return letters
    .map((letter, i) => {
      const p = usable[i];
      const label = p ? String(p.prompt || p.answer).trim() : `(structure ${i + 1})`;
      return `Box ${letter} MUST align horizontally with the matching structure on the left (${label}). Centre the box on the same vertical level as that structure — not above or below it.`;
    })
    .join("\n");
}

/**
 * Pre-delivery checklist for image authors / generators.
 * @param {Array<{ prompt?: string, answer?: string }>} [pairs]
 * @returns {string}
 */
function formatPreDeliveryValidationLines(pairs) {
  const letters = ["A", "B", "C", "D"];
  const usable = Array.isArray(pairs)
    ? pairs.filter((p) => p && String(p.prompt || p.answer || "").trim()).slice(0, 4)
    : [];
  if (!usable.length) {
    return "- Check that each A–D box aligns horizontally with its matching labelled structure on the left.";
  }
  return letters
    .map((letter, i) => {
      const p = usable[i];
      const label = p ? String(p.prompt || p.answer).trim() : `structure for box ${letter}`;
      return `- Check that ${letter} aligns to ${label}`;
    })
    .join("\n");
}

/**
 * @param {Array<{ prompt?: string, answer?: string }>} [pairs]
 * @returns {string}
 */
function formatInAppConceptCardsLines(pairs) {
  const usable = Array.isArray(pairs)
    ? pairs.filter((p) => p && String(p.prompt || p.answer || "").trim()).slice(0, 4)
    : [];
  if (!usable.length) {
    return "• (Match each in-app concept card to the correct printed drop box A–D.)";
  }
  return usable
    .map((p, i) => {
      const letter = ["A", "B", "C", "D"][i] || "?";
      const prompt = String(p.prompt || "").trim() || "(prompt)";
      const answer = String(p.answer || "").trim();
      return answer
        ? `• Card → box ${letter}: ${prompt} (answer after Check: ${answer})`
        : `• Card → box ${letter}: ${prompt}`;
    })
    .join("\n");
}

/**
 * Strict visual contract block for text-to-image main image and diagram drop-zone artwork.
 * @param {{ pairs?: Array<{ prompt?: string, answer?: string }> }} [opts]
 * @returns {string}
 */
function formatDragDropImageDesignRequirements(opts = {}) {
  const { pairs } = opts;
  const lines = [
    IMAGE_DESIGN_REQUIREMENTS_HEADING,
    "",
    "MUST be 900×1350 portrait (taller than wide).",
    "MUST NOT use landscape layout.",
    "MUST use 68% left diagram area and 32% right functional matching rail.",
    "The right rail is a functional matching rail, not a decorative panel.",
    "MUST use four empty drop boxes labelled A, B, C, D only.",
    "MUST NOT use extra numeric labels 1–4 on the image when A–D drop boxes are used.",
    "Each printed drop box MUST be at least 320×110 px on the 900×1350 artboard.",
    "Keep all drop boxes identical in size.",
    "Each box MUST be large enough to contain the longest draggable concept card text when a student places it — text must fit inside the printed box without overflowing above or below.",
    "Leave at least ~140 px vertical spacing between drop box tops (four stacked boxes).",
    "Prefer 68% diagram (left) and 32% matching rail (right); if 320 px-wide boxes do not fit in 32%, expand the right rail slightly (up to ~36% of artboard width) while keeping the pathway readable on the left.",
    "Do not stretch boxes to different heights — all four boxes same dimensions.",
    "Strict vertical alignment: each A–D box must share the same horizontal centreline as its matching structure on the left.",
    "Students should be able to visually connect each labelled structure to its matching A–D box without ambiguity.",
    "Concept cards are rendered separately by the application.",
    "Do NOT draw concept card answer text inside the image.",
    "Do NOT draw draggable concept cards inside the image.",
    "White background; GCSE AQA LetsRevise style — thick black outlines, minimal colour, large readable text.",
  ];

  if (pairs && pairs.length) {
    lines.push(
      "",
      "Strict horizontal alignment (printed boxes on image):",
      formatDropZoneAlignmentLines(pairs),
      "",
      "In-app concept cards (NOT in image):",
      formatInAppConceptCardsLines(pairs),
      "",
      "Before finalising the image:",
      formatPreDeliveryValidationLines(pairs)
    );
  } else {
    lines.push(
      "",
      "Before finalising the image:",
      formatPreDeliveryValidationLines(pairs)
    );
  }

  return lines.join("\n");
}

module.exports = {
  IMAGE_DESIGN_REQUIREMENTS_HEADING,
  formatDragDropImageDesignRequirements,
  formatDropZoneAlignmentLines,
  formatInAppConceptCardsLines,
  formatPreDeliveryValidationLines,
};
