/**
 * P3.0C/D — Pedagogy-specific brief rules for composeDiagramBrief().
 */
const { ACTIVITY_PEDAGOGY_TYPES } = require("./schema");

/** @type {Record<string, { recallTask: string, cardContent: string, imageMustNot: string[] }>} */
const PEDAGOGY_PROFILES = {
  "structure-to-function": {
    recallTask: "Match each function description to the correct numbered structure (Function → Recall Structure).",
    cardContent: "Functions only — no structure names on cards unless used as distractors.",
    imageMustNot: [
      "Structure names or anatomical text labels",
      "Function names or descriptions",
      "Answers or definitions",
      "Concept card text",
      "Dotted boxes or drop zones",
    ],
  },
  "function-to-structure": {
    recallTask: "Match each structure name to the correct numbered region (Structure → Recall Function).",
    cardContent: "Structure names only.",
    imageMustNot: [
      "Function descriptions",
      "Answers or definitions",
      "Concept card text",
      "Dotted boxes or drop zones",
    ],
  },
  "label-to-structure": {
    recallTask: "Match each structure name to the correct numbered region (Label → Structure).",
    cardContent: "Structure names only.",
    imageMustNot: [
      "Structure name labels on the diagram",
      "Function text",
      "Answers on the image",
      "Concept card text",
      "Dotted boxes or drop zones",
    ],
  },
  "process-step-to-order": {
    recallTask: "Place process steps in the correct order (Order → Process Understanding).",
    cardContent: "Stage or step descriptions only.",
    imageMustNot: [
      "Step descriptions on the diagram",
      "Ordered numbers with answer text",
      "Concept card text",
      "Dotted boxes or drop zones",
    ],
  },
  "cause-to-effect": {
    recallTask: "Match each effect to the correct cause region (Cause → Effect).",
    cardContent: "Effects or causes only (per activity design).",
    imageMustNot: [
      "Paired cause-effect text on the diagram",
      "Answers on the image",
      "Concept card text",
      "Dotted boxes or drop zones",
    ],
  },
  "variable-to-definition": {
    recallTask: "Match each definition to the correct variable (Definition → Variable).",
    cardContent: "Definitions only.",
    imageMustNot: [
      "Variable names with definitions on the diagram",
      "Answers on the image",
      "Concept card text",
      "Dotted boxes or drop zones",
    ],
  },
};

const COMPLEX_ANATOMY_TOPICS = [
  "brain",
  "eye",
  "heart",
  "nephron",
  "reflex",
  "endocrine",
  "hormonal",
];

function isPedagogyDrivenBrief(activityPedagogyType) {
  return Boolean(activityPedagogyType && PEDAGOGY_PROFILES[activityPedagogyType]);
}

/** P3.0D.1 — structure-to-function uses anonymous Region IDs in image briefs. */
function usesRegionIdAbstraction(activityPedagogyType) {
  return activityPedagogyType === "structure-to-function";
}

function getOrderedHotspots(spec) {
  return [...(spec.activities?.hotspots || [])].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
  );
}

function labelToDisplayName(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function inferComplexAnatomy(spec) {
  if (spec.layout?.complexAnatomy === true) return true;
  const hay = `${spec.topic} ${spec.subtopic || ""} ${spec.title}`.toLowerCase();
  return COMPLEX_ANATOMY_TOPICS.some((t) => hay.includes(t));
}

function buildHotspotMappingSection(spec) {
  const hotspots = getOrderedHotspots(spec);
  if (!hotspots.length) return "";

  const regionTerm = usesRegionIdAbstraction(spec.activityPedagogyType) ? "Region" : "structure";
  const lines = hotspots.map((h) => {
    const n = h.id;
    return `- Hotspot ${n} on ${regionTerm} ${n}  ↔  Hotspot ${n} beside overlay row`;
  });

  return [
    "HOTSPOT MAPPING RULE (complex anatomy):",
    "Do NOT rely on horizontal alignment alone.",
    `Each numbered marker on the ${regionTerm.toLowerCase()} MUST be repeated beside its matching overlay row.`,
    "",
    ...lines,
  ].join("\n");
}

function buildPedagogyValidationSection(spec) {
  const profile = PEDAGOGY_PROFILES[spec.activityPedagogyType];
  if (!profile) return "";

  return [
    "PEDAGOGY VALIDATION (before generating):",
    `What is the student trying to recall? ${profile.recallTask}`,
    "The image must NEVER contain the answer.",
    "",
    "MUST NOT appear on the image:",
    ...profile.imageMustNot.map((item) => `- ${item}`),
  ].join("\n");
}

function buildImageElementsSection(spec) {
  if (usesRegionIdAbstraction(spec.activityPedagogyType)) {
    return buildRegionAbstractedImageElements(spec);
  }

  const elements = spec.imageElements || [];
  if (!elements.length) {
    return "Highlight target structures visually. Use numbered hotspots only — no text labels.";
  }
  return elements.map((el) => `• ${el}`).join("\n");
}

/** P3.0D.1 — anonymous region IDs only; no biological structure names. */
function buildRegionAbstractedImageElements(spec) {
  const hotspots = getOrderedHotspots(spec);
  if (!hotspots.length) {
    return "Highlight target regions visually. Use numbered hotspots only — no text labels.";
  }

  const lines = [];
  for (const h of hotspots) {
    lines.push(`• Region ${h.id} highlighted`);
  }
  lines.push("");
  const withOverlay = inferComplexAnatomy(spec);
  for (const h of hotspots) {
    const overlay = withOverlay ? ` + matching ${h.id} beside overlay row` : "";
    lines.push(`• Numbered hotspot ${h.id} on Region ${h.id}${overlay}`);
  }
  return lines.join("\n");
}

function buildConceptCardsSection(spec) {
  const cards = spec.conceptCards || [];
  if (!cards.length) {
    const dragDrop = spec.activities?.dragDrop || [];
    if (dragDrop.length) {
      return dragDrop.map((d) => `• ${d.prompt}`).join("\n");
    }
    return "(Concept cards rendered by application — not in image.)";
  }
  return cards.map((c) => `• ${c}`).join("\n");
}

function buildTeacherAnswerKeySection(spec) {
  const hotspots = getOrderedHotspots(spec);
  if (!hotspots.length) return "";

  const lines = hotspots.map((h, i) => {
    return `- Hotspot ${h.id} ↔ Concept card ${i + 1} (structure + answer revealed by application after check)`;
  });

  return [
    "TEACHER ANSWER KEY (application metadata — do NOT render in image):",
    "",
    ...lines,
  ].join("\n");
}

/**
 * P3.0D.1 — biological mappings, concept cards, and answer key for teachers/app.
 * Never included in the image-generation brief.
 */
function buildTeacherMetadataSection(spec) {
  if (!usesRegionIdAbstraction(spec.activityPedagogyType)) return "";

  const hotspots = getOrderedHotspots(spec);
  const labelById = Object.fromEntries(spec.labels.map((l) => [l.id, l]));
  const lines = ["TEACHER METADATA (NOT FOR IMAGE):", ""];

  for (const h of hotspots) {
    const label = labelById[h.labelId];
    const structureName = label?.text ? labelToDisplayName(label.text) : h.labelId;
    lines.push(`Region ${h.id} = ${structureName}`);
  }

  const cards = spec.conceptCards || [];
  if (cards.length) {
    lines.push("");
    lines.push("Concept Cards (application-rendered):");
    for (const card of cards) {
      lines.push(`• ${card}`);
    }
  }

  if (hotspots.length) {
    lines.push("");
    lines.push("Answer key:");
    for (const [i, h] of hotspots.entries()) {
      const label = labelById[h.labelId];
      const structureName = label?.text ? labelToDisplayName(label.text) : h.labelId;
      const card = cards[i];
      lines.push(
        `- Hotspot ${h.id} ↔ Region ${h.id} (${structureName}) ↔ Concept card ${i + 1}${card ? ` ("${card}")` : ""}`
      );
    }
  }

  return lines.join("\n");
}

module.exports = {
  PEDAGOGY_PROFILES,
  ACTIVITY_PEDAGOGY_TYPES,
  isPedagogyDrivenBrief,
  usesRegionIdAbstraction,
  getOrderedHotspots,
  inferComplexAnatomy,
  buildHotspotMappingSection,
  buildPedagogyValidationSection,
  buildImageElementsSection,
  buildRegionAbstractedImageElements,
  buildConceptCardsSection,
  buildTeacherAnswerKeySection,
  buildTeacherMetadataSection,
};
