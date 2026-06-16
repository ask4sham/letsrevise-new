/**
 * P3.0B/D — Diagram Brief Composer.
 * Converts a validated DiagramSpecification into a ChatGPT-ready diagram brief.
 * Branches on activityPedagogyType for drag-and-drop cognitive tasks (P3.0D).
 */
const { validateDiagramSpecification } = require("./validator");
const {
  isPedagogyDrivenBrief,
  usesRegionIdAbstraction,
  inferComplexAnatomy,
  buildHotspotMappingSection,
  buildPedagogyValidationSection,
  buildImageElementsSection,
  buildConceptCardsSection,
  buildTeacherAnswerKeySection,
  buildTeacherMetadataSection,
  PEDAGOGY_PROFILES,
} = require("./pedagogyBriefRules");
const {
  hasActivityBrief,
  buildActivityOpeningLine,
  buildActivityInstructionSection,
  buildImageMustShowSection,
  buildAnswerDisplayRuleSection,
  buildLetterHotspotElementsSection,
  buildActivityHotspotsSection,
  buildActivityTeacherMetadataSection,
  buildActivityStyleSection,
} = require("./activityBriefRules");

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

function buildOpeningLine(spec) {
  return `Create a GCSE ${spec.examBoard} ${spec.tier} Tier ${spec.subject.replace(/^GCSE\s+/i, "")} diagram.`;
}

function buildInstructionSection(spec, { imageBrief = false } = {}) {
  const lines = [];
  if (spec.title) lines.push(`Title: ${spec.title}`);
  if (spec.subtopic) lines.push(`Subtopic: ${spec.subtopic}`);
  lines.push(`Topic: ${spec.topic}`);
  lines.push("");
  lines.push("Learning goal:");
  lines.push(spec.learningGoal);
  lines.push("");
  if (spec.instruction) lines.push(spec.instruction);
  const omitExamFocus =
    imageBrief && usesRegionIdAbstraction(spec.activityPedagogyType);
  if (spec.examFocus?.length && !omitExamFocus) {
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

function buildInteractionNotesSection(spec) {
  const types = spec.interactionTypes || [];
  const notes = [];
  if (types.includes("hotspot")) notes.push("Diagram must support click-to-reveal hotspot activities.");
  if (types.includes("drag-drop") || types.includes("tti")) {
    notes.push("Diagram must support drag-and-drop — application owns drop zones and cards.");
  }
  if (types.includes("label-overlay")) notes.push("Leave space for label overlay / reveal activities.");
  if (types.includes("exam-question")) {
    notes.push("Layout should support exam questions (do not render questions in the image).");
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
    "- Arrows show direction of process, impulse, or flow where relevant",
  ].filter((l) => l != null);
  return lines.join("\n");
}

function buildStyleSection(pedagogyDriven = false) {
  const labelRules = pedagogyDriven
    ? [
        "LABELS:",
        "- Use numbered hotspot markers only (1, 2, 3, 4…)",
        "- NO structure names or function text on the image",
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

function buildOutputSection(spec) {
  const style = spec.visualStyle || {};
  const lines = [
    "- Flat vector style",
    "- High contrast — readable when printed in greyscale",
    "- Exam ready — suitable for GCSE revision handouts",
    "- Copyright safe — original artwork only",
  ];
  if (style.noPhotorealism !== false) lines.push("- NO photorealism, NO 3D rendering");
  if (style.minimalColour !== false) lines.push("- Colour only where it aids learning");
  return lines.join("\n");
}

function buildFrameSection(spec, options) {
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
  if (!spec.instruction) warnings.push("No instruction field — brief uses learningGoal only");
  if (
    options.includeHotspots &&
    spec.interactionTypes?.includes("hotspot") &&
    !(spec.activities?.hotspots?.length)
  ) {
    warnings.push("interactionTypes includes hotspot but no activities.hotspots defined");
  }
  if (spec.teacherNotes) warnings.push("teacherNotes omitted from brief (teacher-only metadata)");
  return warnings;
}

/**
 * P3.0D — pedagogy-driven brief (drag-and-drop / TTI retrieval activities).
 * @param {DiagramSpecification} spec
 * @param {typeof DEFAULT_OPTIONS} opts
 */
function composePedagogyDrivenBrief(spec, opts) {
  const sections = [];
  const profile = PEDAGOGY_PROFILES[spec.activityPedagogyType];
  const regionAbstracted = usesRegionIdAbstraction(spec.activityPedagogyType);

  sections.push(buildOpeningLine(spec));
  sections.push("");
  sections.push(`Activity pedagogy type: ${spec.activityPedagogyType}`);
  sections.push("");
  sections.push("Instruction:");
  sections.push(buildInstructionSection(spec, { imageBrief: true }));
  sections.push("");
  sections.push(buildPedagogyValidationSection(spec));
  sections.push("");
  sections.push("Image Elements:");
  sections.push(buildImageElementsSection(spec));

  if (!regionAbstracted) {
    sections.push("");
    sections.push("Concept Cards (application-rendered — NOT in image):");
    sections.push(buildConceptCardsSection(spec));
  }

  if (profile) {
    sections.push("");
    sections.push(`Student task: ${profile.recallTask}`);
  }

  if (opts.includeHotspots && inferComplexAnatomy(spec)) {
    sections.push("");
    sections.push(buildHotspotMappingSection(spec));
  }

  if (opts.includeAnswerKey && !regionAbstracted) {
    const teacherKey = buildTeacherAnswerKeySection(spec);
    if (teacherKey) {
      sections.push("");
      sections.push(teacherKey);
    }
  }

  if (opts.includeInteractionNotes) {
    const notes = buildInteractionNotesSection(spec);
    if (notes) {
      sections.push("");
      sections.push("Interaction notes:");
      sections.push(notes);
    }
  }

  sections.push("");
  sections.push("STYLE:");
  sections.push(buildStyleSection(true));
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

  return sections.join("\n").trim();
}

/**
 * P3.0E — activity-contract brief from lesson blocks (activity-specific, not generic topic).
 * @param {DiagramSpecification} spec
 * @param {typeof DEFAULT_OPTIONS} opts
 */
function composeActivityContractBrief(spec, opts) {
  const sections = [];
  const profile = PEDAGOGY_PROFILES[spec.activityPedagogyType];
  const mode = spec.activityBrief?.answerOnImage;
  const pedagogyDriven = isPedagogyDrivenBrief(spec.activityPedagogyType);
  const regionAbstracted = usesRegionIdAbstraction(spec.activityPedagogyType);
  const hideAnswersOnImage =
    mode === "letters-only" || mode === "region-ids" || mode === "overlay-cards";

  sections.push(buildActivityOpeningLine(spec));
  sections.push("");
  if (spec.activityBrief?.sourceBlockType) {
    sections.push(`Source block type: ${spec.activityBrief.sourceBlockType}`);
    sections.push("");
  }
  if (spec.activityPedagogyType) {
    sections.push(`Activity pedagogy type: ${spec.activityPedagogyType}`);
    sections.push("");
  }
  sections.push(buildActivityInstructionSection(spec));
  sections.push("");
  const imageMustShow = buildImageMustShowSection(spec);
  if (imageMustShow) {
    sections.push(imageMustShow);
    sections.push("");
  }
  const answerRule = buildAnswerDisplayRuleSection(spec);
  if (answerRule) {
    sections.push(answerRule);
    sections.push("");
  }

  if (pedagogyDriven && hideAnswersOnImage) {
    if (mode === "letters-only") {
      sections.push([
        "PEDAGOGY VALIDATION (before generating):",
        "What is the student trying to recall? Match each pathway label to the correct lettered hotspot (Label → Structure).",
        "The image must NEVER contain the answer.",
        "",
        "MUST NOT appear on the image:",
        "- Answer label text (Stimulus, Receptor, etc.)",
        "- Function descriptions as visible labels",
        "- Concept card text",
        "- Dotted boxes or drop zones",
      ].join("\n"));
    } else {
      sections.push(buildPedagogyValidationSection(spec));
    }
    sections.push("");
    sections.push("Image Elements:");
    sections.push(buildImageElementsSection(spec));
  } else if (mode === "full-labels") {
    sections.push("Instruction:");
    sections.push(buildInstructionSection(spec));
    sections.push("");
    sections.push("Labels to use:");
    sections.push(buildLabelsSection(spec));
  }

  if (opts.includeHotspots && spec.activities?.hotspots?.length) {
    sections.push("");
    sections.push(buildActivityHotspotsSection(spec));
  }

  const studentTask = spec.activityBrief?.studentTask || profile?.recallTask;
  if (studentTask) {
    sections.push("");
    sections.push(`Student task: ${studentTask}`);
  }

  if (opts.includeHotspots && inferComplexAnatomy(spec) && regionAbstracted) {
    sections.push("");
    sections.push(buildHotspotMappingSection(spec));
  }

  if (opts.includeInteractionNotes) {
    const notes = buildInteractionNotesSection(spec);
    if (notes) {
      sections.push("");
      sections.push("Interaction notes:");
      sections.push(notes);
    }
  }

  sections.push("");
  sections.push("STYLE:");
  sections.push(buildActivityStyleSection(spec));
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

  return sections.join("\n").trim();
}

/**
 * Legacy labelled-diagram brief (static / hotspot / no pedagogy type).
 * @param {DiagramSpecification} spec
 * @param {typeof DEFAULT_OPTIONS} opts
 */
function composeLabelledDiagramBrief(spec, opts) {
  const sections = [];

  sections.push(buildOpeningLine(spec));
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
    spec.activities?.hotspots?.length;

  if (showHotspots) {
    sections.push("");
    sections.push("Hotspots / parts:");
    sections.push(buildHotspotsSection(spec));
  }

  if (opts.includeAnswerKey && spec.activities?.hotspots?.length) {
    sections.push("");
    sections.push("Answer key:");
    sections.push(buildAnswerKeySection(spec));
  }

  if (opts.includeInteractionNotes) {
    const notes = buildInteractionNotesSection(spec);
    if (notes) {
      sections.push("");
      sections.push("Interaction notes (do not render as image text):");
      sections.push(notes);
    }
  }

  sections.push("");
  sections.push("STYLE:");
  sections.push(buildStyleSection(false));
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

  return sections.join("\n").trim();
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
      teacherMetadata: null,
      errors: validation.errors,
      warnings: [],
      metadata: null,
    };
  }

  const spec = validation.normalized;
  const warnings = collectWarnings(spec, opts);
  const pedagogyDriven = isPedagogyDrivenBrief(spec.activityPedagogyType);
  const fromActivityContract = hasActivityBrief(spec);

  const brief = fromActivityContract
    ? composeActivityContractBrief(spec, opts)
    : pedagogyDriven
      ? composePedagogyDrivenBrief(spec, opts)
      : composeLabelledDiagramBrief(spec, opts);

  const teacherMetadata = fromActivityContract
    ? buildActivityTeacherMetadataSection(spec)
    : usesRegionIdAbstraction(spec.activityPedagogyType)
      ? buildTeacherMetadataSection(spec)
      : null;

  return {
    ok: true,
    brief,
    teacherMetadata,
    warnings,
    metadata: {
      specId: spec.id,
      diagramType: spec.diagramType,
      activityPedagogyType: spec.activityPedagogyType || null,
      interactionTypes: [...spec.interactionTypes],
      labelCount: spec.labels.length,
      hotspotCount: spec.activities?.hotspots?.length || 0,
      pedagogyDriven,
      regionIdAbstracted: usesRegionIdAbstraction(spec.activityPedagogyType),
      activityContract: fromActivityContract,
      answerOnImage: spec.activityBrief?.answerOnImage || null,
    },
    errors: [],
  };
}

module.exports = {
  composeDiagramBrief,
  composePedagogyDrivenBrief,
  composeActivityContractBrief,
  composeLabelledDiagramBrief,
  DEFAULT_OPTIONS,
};
