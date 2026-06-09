/**
 * Drag-drop activity image design contract — prompt text for Teacher Brain / generators.
 * Source of truth: docs/design/DRAG_DROP_VISUAL_CONTRACT.md
 * Phase 2: prompts only — does not affect renderer, CSS, or lesson payloads.
 */

const {
  getTtiBoxGeometryLayout,
  formatTtiBoxGeometryContractLines,
} = require("../ttiBoxGeometry");

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
 * Text-to-image: structure-to-blank-rail-row alignment (no letters drawn in image).
 * @param {Array<{ prompt?: string, answer?: string }>} [pairs]
 * @returns {string}
 */
function formatTtiStructureRowAlignmentLines(pairs) {
  const rowLabels = ["first (top)", "second", "third", "fourth (bottom)"];
  const usable = Array.isArray(pairs)
    ? pairs.filter((p) => p && String(p.prompt || p.answer || "").trim()).slice(0, 4)
    : [];
  return usable
    .map((p, i) => {
      const label = String(p.prompt || p.answer).trim();
      const row = rowLabels[i] || `row ${i + 1}`;
      return `Blank right-rail row ${i + 1} (${row}): MUST align horizontally with the matching structure on the left (${label}). Leave only clean white space on the right — no letters, boxes, or borders.`;
    })
    .join("\n");
}

/**
 * @deprecated Legacy marker-letter alignment — not used in diagram-only text-to-image briefs.
 */
function formatTtiMarkerAlignmentLines(pairs) {
  return formatTtiStructureRowAlignmentLines(pairs);
}

/**
 * Pre-delivery checklist for image authors / generators.
 * @param {Array<{ prompt?: string, answer?: string }>} [pairs]
 * @returns {string}
 */
function formatTtiPreDeliveryValidationLines(pairs) {
  const rowLabels = ["first", "second", "third", "fourth"];
  const usable = Array.isArray(pairs)
    ? pairs.filter((p) => p && String(p.prompt || p.answer || "").trim()).slice(0, 4)
    : [];
  const base = [
    "- Confirm the image has NO A, B, C, or D letters anywhere.",
    "- Confirm NO marker letters, answer boxes, dotted boxes, rectangles, or concept-card text in the image.",
    "- Confirm the right functional rail is blank white space for app-rendered targets.",
    "- Confirm dotted target boxes are NOT drawn in the image — only the app renders them.",
    "- Confirm NO hard-line answer rectangles, printed drop boxes, box outlines, or answer-card shapes.",
  ];
  if (!usable.length) {
    return [
      ...base,
      "- Check that each blank right-rail row aligns horizontally with its matching labelled structure on the left.",
    ].join("\n");
  }
  return [
    ...base,
    ...usable.map((p, i) => {
      const label = String(p.prompt || p.answer).trim();
      const row = rowLabels[i] || `row ${i + 1}`;
      return `- Check that blank right-rail row ${i + 1} (${row}) aligns horizontally with ${label}`;
    }),
  ].join("\n");
}

/** Runtime overlay reference for authors — blank rail zones only (nothing drawn in image). */
function formatTtiBlankRailOverlayReferenceLines() {
  const pt = getTtiBoxGeometryLayout("portrait");
  const sq = getTtiBoxGeometryLayout("square-display");
  return [
    `On the 900×1350 portrait artboard, reserve four equal blank white zones in the right rail (${pt.box.widthPx}×${pt.box.heightPx} px each) — draw nothing inside them.`,
    `Student display overlay alignment (app-rendered, not drawn in image): centre X ${sq.box.centerXPx} px (${sq.box.centerXPct}%); row centre Y top-to-bottom: ${sq.zones.map((z, i) => `row ${i + 1} ${z.centerYPx} px`).join("; ")}.`,
    "Minimum vertical gap between blank row areas on 600×600 display: ~62 px.",
  ];
}

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
function formatTtiInAppConceptCardsLines(pairs) {
  const usable = Array.isArray(pairs)
    ? pairs.filter((p) => p && String(p.prompt || p.answer || "").trim()).slice(0, 4)
    : [];
  if (!usable.length) {
    return "• (Match each in-app concept card to the correct runtime overlay zone A–D.)";
  }
  return usable
    .map((p, i) => {
      const letter = ["A", "B", "C", "D"][i] || "?";
      const prompt = String(p.prompt || "").trim() || "(prompt)";
      const answer = String(p.answer || "").trim();
      return answer
        ? `• Card → overlay zone ${letter}: ${prompt} (answer after Check: ${answer})`
        : `• Card → overlay zone ${letter}: ${prompt}`;
    })
    .join("\n");
}

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
    ...formatTtiBoxGeometryContractLines(),
    "Each box MUST be large enough to contain the longest draggable concept card text when a student places it — text must fit inside the printed box without overflowing above or below.",
    "Leave at least ~62 px vertical spacing between drop box outer edges on the 600×600 student display.",
    "Prefer 68% diagram (left) and 32% matching rail (right); if boxes do not fit in 32%, expand the right rail slightly (up to ~36% of artboard width) while keeping the pathway readable on the left.",
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

/**
 * Text-to-image main image only — diagram + blank right rail; app owns all targets.
 * @param {{ pairs?: Array<{ prompt?: string, answer?: string }> }} [opts]
 * @returns {string}
 */
function formatTextToImageImageDesignRequirements(opts = {}) {
  const { pairs } = opts;
  const lines = [
    IMAGE_DESIGN_REQUIREMENTS_HEADING,
    "",
    "Drop-zone ownership (text-to-image):",
    "The application owns all targets: dotted boxes, drop positions, dropped cards, and labels/answers after Check.",
    "The image owns only the educational diagram and a clean blank right-hand rail.",
    "Do NOT draw A, B, C, D letters in the image.",
    "Do NOT draw marker letters, answer boxes, dotted boxes, rectangles, or concept-card text.",
    "Leave the right functional rail blank and clean so the application can render all targets.",
    "Do NOT draw answer rectangles or hard-line drop boxes inside the image.",
    "No duplicate boxes. No hard-line rectangles. No answer text inside the image.",
    "",
    "Artboard and layout:",
    "MUST be 900×1350 portrait (taller than wide).",
    "MUST NOT use landscape layout.",
    "MUST use 68% left diagram area and 32% right functional matching rail.",
    "The right functional rail MUST be blank white space — not a decorative panel and not labelled.",
    "On the 900×1350 portrait artboard, leave the right functional rail empty: four stacked blank white zones (top to bottom) where the app will place dotted drop targets.",
    "MUST NOT draw empty answer boxes, printed target rectangles, hard-line drop boxes, drop-zone outlines, dashed boxes, marker letters, numeric 1–4 labels, or answer-card shapes in the image.",
    "The runtime application owns all drop-zone rectangles, dotted borders, filled cards, and placement — not the image.",
    ...formatTtiBlankRailOverlayReferenceLines(),
    "Prefer 68% diagram (left) and 32% matching rail (right); if blank zones do not fit in 32%, expand the right rail slightly (up to ~36% of artboard width) while keeping the pathway readable on the left.",
    "Strict vertical alignment: each blank right-rail row must share the same horizontal centreline as its matching labelled structure on the left.",
    "Students should be able to visually connect each labelled structure to its corresponding blank right-rail zone without ambiguity.",
    "Concept cards are rendered separately by the application.",
    "Do NOT draw concept card answer text inside the image.",
    "Do NOT draw draggable concept cards inside the image.",
    "White background; GCSE AQA LetsRevise style — thick black outlines, minimal colour, large readable diagram labels.",
  ];

  if (pairs && pairs.length) {
    lines.push(
      "",
      "Strict horizontal alignment (blank right-rail rows):",
      formatTtiStructureRowAlignmentLines(pairs),
      "",
      "In-app concept cards (NOT in image):",
      formatTtiInAppConceptCardsLines(pairs),
      "",
      "Before finalising the image:",
      formatTtiPreDeliveryValidationLines(pairs)
    );
  } else {
    lines.push("", "Before finalising the image:", formatTtiPreDeliveryValidationLines(pairs));
  }

  return lines.join("\n");
}

module.exports = {
  IMAGE_DESIGN_REQUIREMENTS_HEADING,
  formatDragDropImageDesignRequirements,
  formatTextToImageImageDesignRequirements,
  formatDropZoneAlignmentLines,
  formatTtiStructureRowAlignmentLines,
  formatTtiMarkerAlignmentLines,
  formatInAppConceptCardsLines,
  formatTtiInAppConceptCardsLines,
  formatPreDeliveryValidationLines,
  formatTtiPreDeliveryValidationLines,
};
