/**
 * P3.0E — Activity-contract brief rules (lesson block → activity-specific prompts).
 */
const {
  usesRegionIdAbstraction,
  getOrderedHotspots,
  buildPedagogyValidationSection,
  buildImageElementsSection,
  buildHotspotMappingSection,
  inferComplexAnatomy,
  PEDAGOGY_PROFILES,
} = require("./pedagogyBriefRules");

const ANSWER_ON_IMAGE_MODES = Object.freeze([
  "letters-only",
  "region-ids",
  "full-labels",
  "overlay-cards",
]);

function hasActivityBrief(spec) {
  return Boolean(spec.activityBrief?.activityInstruction || spec.activityBrief?.imageMustShow);
}

function buildActivityOpeningLine(spec) {
  const subject = spec.subject.replace(/^GCSE\s+/i, "");
  const diagramKind =
    spec.diagramType === "hotspot"
      ? "hotspot diagram"
      : spec.diagramType === "practical-setup"
        ? "required practical diagram"
        : `${spec.diagramType} diagram`;
  return `Create a GCSE ${spec.examBoard} ${spec.tier} Tier ${subject} ${diagramKind} for the "${spec.title}" activity.`;
}

function buildActivityInstructionSection(spec) {
  const ab = spec.activityBrief || {};
  const lines = ["ACTIVITY INSTRUCTION (from lesson block):"];
  if (ab.activityInstruction) lines.push(ab.activityInstruction);
  if (ab.studentTask) {
    lines.push("");
    lines.push("Student task:");
    lines.push(ab.studentTask);
  }
  return lines.join("\n");
}

function buildImageMustShowSection(spec) {
  const text = spec.activityBrief?.imageMustShow;
  if (!text) return "";
  return [
    "IMAGE MUST SHOW (activity context — not generic topic art):",
    text,
  ].join("\n");
}

function buildAnswerDisplayRuleSection(spec) {
  const mode = spec.activityBrief?.answerOnImage;
  if (!mode) return "";

  const rules = {
    "letters-only": [
      "ANSWER DISPLAY RULE:",
      "- Show hotspot letters only (A, B, C, D…) on the image",
      "- Do NOT render the answer label text on the image",
      "- The student fills or matches labels during the activity",
      "- Answer mappings are in teacher metadata only",
    ],
    "region-ids": [
      "ANSWER DISPLAY RULE:",
      "- Show numbered region markers only (1, 2, 3, 4…)",
      "- Do NOT render structure names or function text on the image",
      "- Concept cards and answers are application-rendered overlays",
    ],
    "overlay-cards": [
      "ANSWER DISPLAY RULE:",
      "- Show diagram regions and hotspot markers only",
      "- Draggable card text is rendered by the application — NOT on the image",
      "- Do NOT render pair prompts or answers on the image",
    ],
    "full-labels": [
      "ANSWER DISPLAY RULE:",
      "- Render all required labels on the image as specified below",
      "- This is a static or fully labelled reference diagram",
    ],
  };

  return (rules[mode] || []).join("\n");
}

function buildLetterHotspotElementsSection(spec) {
  const hotspots = getOrderedHotspots(spec);
  const lines = [];
  for (const h of hotspots) {
    lines.push(`• Hotspot marker ${h.id} on the target pathway stage (letter only — no answer text)`);
  }
  return lines.join("\n");
}

function buildActivityHotspotsSection(spec) {
  const hotspots = getOrderedHotspots(spec);
  if (!hotspots.length) return "";

  const labelById = Object.fromEntries(spec.labels.map((l) => [l.id, l]));
  const mode = spec.activityBrief?.answerOnImage;
  const lines = hotspots.map((h) => {
    const label = labelById[h.labelId];
    const answer = label?.mapsTo || label?.description || label?.text || h.labelId;
    if (mode === "letters-only") {
      return `- Hotspot ${h.id}: letter marker on image — represents "${answer}"`;
    }
    if (mode === "region-ids") {
      return `- Hotspot ${h.id}: numbered marker on image — region ${h.id}`;
    }
    return `- Hotspot ${h.id}: ${label?.text || h.labelId}${answer ? ` — ${answer}` : ""}`;
  });

  return ["Hotspots (activity contract):", "", ...lines].join("\n");
}

function buildActivityTeacherMetadataSection(spec) {
  const ab = spec.activityBrief || {};
  const hotspots = getOrderedHotspots(spec);
  const labelById = Object.fromEntries(spec.labels.map((l) => [l.id, l]));
  const lines = ["TEACHER METADATA (NOT FOR IMAGE):", ""];

  if (ab.sourceBlockType) lines.push(`Source block type: ${ab.sourceBlockType}`);
  if (ab.activityInstruction) {
    lines.push("");
    lines.push("Activity instruction:");
    lines.push(ab.activityInstruction);
  }

  const cards = spec.conceptCards || [];
  if (cards.length) {
    lines.push("");
    lines.push("Concept Cards / overlay labels (application-rendered):");
    for (const card of cards) {
      lines.push(`• ${card}`);
    }
  }

  if (hotspots.length) {
    if (ab.answerOnImage === "region-ids") {
      lines.push("");
      lines.push("Region mappings:");
      for (const h of hotspots) {
        const label = labelById[h.labelId];
        const structureName = label?.text ? label.text : h.labelId;
        lines.push(`Region ${h.id} = ${structureName}`);
      }
    }
    lines.push("");
    lines.push("Answer key:");
    for (const h of hotspots) {
      const label = labelById[h.labelId];
      const answer = label?.mapsTo || label?.description || label?.text || h.labelId;
      if (ab.answerOnImage === "region-ids") {
        const card = cards[hotspots.indexOf(h)];
        lines.push(`- Hotspot ${h.id} ↔ Region ${h.id} (${label?.text ? label.text : answer})${card ? ` ↔ "${card}"` : ""}`);
      } else if (ab.answerOnImage === "letters-only") {
        lines.push(`- Hotspot ${h.id} → ${answer}`);
      } else {
        lines.push(`- Hotspot ${h.id} → ${answer}`);
      }
    }
  }

  return lines.join("\n");
}

function buildActivityStyleSection(spec) {
  const mode = spec.activityBrief?.answerOnImage;
  const labelRules =
    mode === "letters-only"
      ? [
          "LABELS:",
          "- Hotspot letters only (A, B, C, D…)",
          "- NO answer label text on the image",
        ]
      : mode === "region-ids"
        ? [
            "LABELS:",
            "- Numbered hotspot markers only (1, 2, 3, 4…)",
            "- NO structure names or function text on the image",
          ]
        : mode === "overlay-cards"
          ? [
              "LABELS:",
              "- Hotspot markers only — no draggable card text on the image",
            ]
          : ["LABELS:", "- UPPERCASE", "- Short", "- AQA terminology only"];

  return [
    "GCSE EXAM DIAGRAM (NOT infographic)",
    "",
    "RULES:",
    "- White background only",
    "- Thick black outlines",
    "- Minimal colours",
    "- No gradients",
    "- No shadows",
    "- No decorative UI elements",
    "",
    ...labelRules,
  ].join("\n");
}

module.exports = {
  ANSWER_ON_IMAGE_MODES,
  hasActivityBrief,
  buildActivityOpeningLine,
  buildActivityInstructionSection,
  buildImageMustShowSection,
  buildAnswerDisplayRuleSection,
  buildLetterHotspotElementsSection,
  buildActivityHotspotsSection,
  buildActivityTeacherMetadataSection,
  buildActivityStyleSection,
};
