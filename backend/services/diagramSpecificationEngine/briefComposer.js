/**
 * P3.0B — Diagram Brief Composer.
 * Converts a validated DiagramSpecification into a ChatGPT-ready diagram brief.
 * No image generation, no API calls, no production wiring.
 */
const { validateDiagramSpecification } = require("./validator");

/** @typedef {import("./schema").DiagramSpecification} DiagramSpecification */

const DEFAULT_OPTIONS = {
  includeFrame: true,
  includeAnswerKey: true,
  includeHotspots: true,
  includeInteractionNotes: true,
  brandName: "LetsRevise",
  examStyle: null,
};

function bulletList(items = []) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildExamStyleLine(spec, options) {
  if (options.examStyle) return options.examStyle;
  const tier = spec.tier || "Higher";
  const subject = spec.subject || "GCSE Biology";
  const board = spec.examBoard || "AQA";
  return `${board} ${tier} Tier ${subject.replace(/^GCSE\s+/i, "")}`.replace(/\s+/g, " ").trim();
}

function buildOpeningLine(spec, options) {
  const examLine = buildExamStyleLine(spec, options);
  return `Create a GCSE ${spec.examBoard} ${spec.tier} Tier ${spec.subject.replace(/^GCSE\s+/i, "")} diagram.`;
}

function buildInstructionSection(spec) {
  const lines = [];
  if (spec.title) lines.push(`Title: ${spec.title}`);
  if (spec.subtopic) lines.push(`Subtopic: ${spec.subtopic}`);
  lines.push(`Topic: ${spec.topic}`);
  lines.push("");
  lines.push("Learning goal:");
  lines.push(spec.learningGoal);
  lines.push("");
  if (spec.instruction) {
    lines.push(spec.instruction);
  }
  if (spec.examFocus?.length) {
    lines.push("");
    lines.push("Exam focus:");
    lines.push(bulletList(spec.examFocus));
  }
  return lines.join("\n").trim();
}

function buildLabelsSection(spec) {
  const required = spec.labels.filter((l) => l.required !== false);
  const lines = required.map((l, i) => {
    const extra = l.mapsTo ? ` — ${l.mapsTo}` : "";
    return `${i + 1}. ${l.text}${extra}`;
  });
  return [
    "Every label below MUST appear on the diagram as large, readable UPPERCASE text.",
    "Do NOT omit, abbreviate, or substitute synonyms.",
    "",
    ...lines,
  ].join("\n");
}

function buildHotspotsSection(spec) {
  const hotspots = spec.activities?.hotspots || [];
  if (!hotspots.length) return "";

  const labelById = Object.fromEntries(spec.labels.map((l) => [l.id, l]));
  const lines = hotspots.map((h) => {
    const label = labelById[h.labelId];
    const region = h.region ? ` (${h.region})` : "";
    const text = label?.text || h.labelId;
    return `- Part ${h.id}: ${text}${region}`;
  });

  return [
    "Design clear distinct regions for each lettered part below.",
    "These areas must support future hotspot or drag-and-drop activities.",
    "",
    ...lines,
  ].join("\n");
}

function buildAnswerKeySection(spec) {
  const hotspots = spec.activities?.hotspots || [];
  if (!hotspots.length) return "";

  const labelById = Object.fromEntries(spec.labels.map((l) => [l.id, l]));
  const lines = hotspots.map((h) => {
    const label = labelById[h.labelId];
    const mapsTo = label?.mapsTo ? ` → ${label.mapsTo}` : "";
    return `- ${h.id}: "${label?.text || h.labelId}"${mapsTo}`;
  });

  return [
    "For teacher reference — small letters A, B, C may appear near regions:",
    "",
    ...lines,
  ].join("\n");
}

function buildDragDropSection(spec) {
  const dragDrop = spec.activities?.dragDrop || [];
  if (!dragDrop.length) return "";

  const labelById = Object.fromEntries(spec.labels.map((l) => [l.id, l]));
  const lines = dragDrop.map((d) => {
    const label = labelById[d.labelId];
    return `- "${d.prompt}" → label: ${label?.text || d.labelId}`;
  });

  return [
    "Leave clear drop-target regions for these drag-and-drop cards:",
    "",
    ...lines,
  ].join("\n");
}

function buildInteractionNotesSection(spec) {
  const types = spec.interactionTypes || [];
  const notes = [];
  if (types.includes("hotspot")) {
    notes.push("Diagram must support click-to-reveal hotspot activities.");
  }
  if (types.includes("drag-drop") || types.includes("tti")) {
    notes.push("Diagram must support drag-and-drop label placement (diagram or TTI mode).");
  }
  if (types.includes("label-overlay")) {
    notes.push("Leave space for label overlay / reveal activities.");
  }
  if (types.includes("exam-question")) {
    notes.push("Layout should make examinable structures easy to test (do not render exam questions in the image).");
  }
  if (!notes.length) return "";
  return notes.join("\n");
}

function buildLayoutSection(spec) {
  const layout = spec.layout || {};
  const lines = [
    `Orientation: ${layout.orientation || "landscape"}`,
    layout.flow ? `Process flow: ${layout.flow}` : null,
    layout.processType ? `Diagram type: ${layout.processType}` : null,
    layout.composition ? `Composition: ${layout.composition}` : null,
    layout.regions?.length ? `Regions: ${layout.regions.join(", ")}` : null,
    "",
    "Layout requirements:",
    "- Single coherent diagram — not disconnected clip-art icons",
    "- Clear visual hierarchy with generous white space",
    "- Leader lines from labels to exact structures",
    "- Arrows show direction of process, impulse, or flow where relevant",
  ].filter((l) => l != null);
  return lines.join("\n");
}

function buildStyleSection() {
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
    "LABELS:",
    "- UPPERCASE",
    "- Short",
    "- AQA terminology only",
  ].join("\n");
}

function buildOutputSection(spec) {
  const style = spec.visualStyle || {};
  const lines = [
    "- Flat vector style",
    "- High contrast — readable when printed in greyscale",
    "- Exam ready — suitable for GCSE revision handouts",
    "- Copyright safe — original artwork only",
  ];
  if (style.noPhotorealism !== false) {
    lines.push("- NO photorealism, NO 3D rendering");
  }
  if (style.minimalColour !== false) {
    lines.push("- Colour only where it aids learning");
  }
  return lines.join("\n");
}

function buildFrameSection(spec, options) {
  const examLine = buildExamStyleLine(spec, options);
  const brand = options.brandName || "LetsRevise";
  return [
    `Place inside ${brand} frame:`,
    `- ${brand} ribbon (top-left, purple #5B21B6 on light purple band)`,
    `- Subtitle banner: GCSE ${spec.examBoard} ${spec.tier.toUpperCase()} TIER ${spec.subject.replace(/^GCSE\s+/i, "").toUpperCase()}`,
    `- Rounded border with subtle purple outline`,
    `- Inner white content panel with padding around the diagram`,
    `- Diagram title centred above inner panel: ${spec.title}`,
    `- Large readable scaling for classroom and print use`,
    `- Do not alter diagram content inside the frame`,
    "",
    `(Exam style line: ${examLine})`,
  ].join("\n");
}

function buildCopyrightSection() {
  return [
    "- Create completely original educational artwork",
    "- Do NOT copy, trace, or imitate textbook diagrams, exam figures, or web images",
    "- Do NOT include real brand logos except the LetsRevise ribbon",
  ].join("\n");
}

function collectWarnings(spec, options) {
  const warnings = [];
  if (!spec.instruction) {
    warnings.push("No instruction field — brief uses learningGoal only");
  }
  if (
    options.includeHotspots &&
    spec.interactionTypes?.includes("hotspot") &&
    !(spec.activities?.hotspots?.length)
  ) {
    warnings.push("interactionTypes includes hotspot but no activities.hotspots defined");
  }
  if (spec.teacherNotes) {
    warnings.push("teacherNotes omitted from brief (teacher-only metadata)");
  }
  return warnings;
}

/**
 * @param {unknown} specInput
 * @param {Partial<typeof DEFAULT_OPTIONS>} [options]
 */
function composeDiagramBrief(specInput, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const validation = validateDiagramSpecification(specInput);

  if (!validation.ok || !validation.normalized) {
    return {
      ok: false,
      brief: "",
      errors: validation.errors,
      warnings: [],
      metadata: null,
    };
  }

  const spec = validation.normalized;
  const warnings = collectWarnings(spec, opts);

  const sections = [];

  sections.push(buildOpeningLine(spec, opts));
  sections.push("");
  sections.push("Instruction:");
  sections.push(buildInstructionSection(spec));
  sections.push("");
  sections.push("Labels to use:");
  sections.push(buildLabelsSection(spec));

  const showHotspots =
    opts.includeHotspots &&
    (spec.interactionTypes.includes("hotspot") ||
      spec.interactionTypes.includes("drag-drop") ||
      spec.interactionTypes.includes("tti")) &&
    (spec.activities?.hotspots?.length || spec.activities?.dragDrop?.length);

  if (showHotspots && spec.activities?.hotspots?.length) {
    sections.push("");
    sections.push("Hotspots / parts:");
    sections.push(buildHotspotsSection(spec));
  }

  if (opts.includeAnswerKey && spec.activities?.hotspots?.length) {
    sections.push("");
    sections.push("Answer key:");
    sections.push(buildAnswerKeySection(spec));
  }

  if (
    spec.interactionTypes.includes("drag-drop") &&
    spec.activities?.dragDrop?.length
  ) {
    sections.push("");
    sections.push("Drag-and-drop targets:");
    sections.push(buildDragDropSection(spec));
  }

  if (opts.includeInteractionNotes) {
    const interactionNotes = buildInteractionNotesSection(spec);
    if (interactionNotes) {
      sections.push("");
      sections.push("Interaction notes (do not render as image text):");
      sections.push(interactionNotes);
    }
  }

  sections.push("");
  sections.push("STYLE:");
  sections.push(buildStyleSection());
  sections.push("");
  sections.push("LAYOUT:");
  sections.push(buildLayoutSection(spec));
  sections.push("");
  sections.push("OUTPUT:");
  sections.push(buildOutputSection(spec));
  sections.push("");
  sections.push("COPYRIGHT:");
  sections.push(buildCopyrightSection());

  if (opts.includeFrame) {
    sections.push("");
    sections.push("THEN:");
    sections.push(buildFrameSection(spec, opts));
  }

  const brief = sections.join("\n").trim();
  const hotspotCount = spec.activities?.hotspots?.length || 0;

  return {
    ok: true,
    brief,
    warnings,
    metadata: {
      specId: spec.id,
      diagramType: spec.diagramType,
      interactionTypes: [...spec.interactionTypes],
      labelCount: spec.labels.length,
      hotspotCount,
    },
    errors: [],
  };
}

module.exports = {
  composeDiagramBrief,
  DEFAULT_OPTIONS,
};
