/**
 * Diagram & activity brief injector — teacher-facing design specs on activity blocks.
 * Phase 3: additive only. Does not generate images or alter block types.
 */

const { resolveDragDropActivityLayout } = require("./dragDropActivityLayout");

const BRIEF_MARKER = "--- TEACHER BRAIN DESIGN BRIEF ---";

const DIAGRAM_ACTIVITY_TYPES = new Set([
  "interactivediagram",
  "interactive diagram",
  "dragdropmatch",
  "drag drop match",
  "interactivesequence",
  "interactive sequence",
  "hotspot",
  "labeldiagram",
]);

const TYPE_ALIASES = {
  interactivediagram: "interactiveDiagram",
  dragdropmatch: "dragDropMatch",
  interactivesequence: "interactiveSequence",
  hotspot: "interactiveDiagram",
  labeldiagram: "interactiveDiagram",
};

const BRIEF_KIND_BY_LAYOUT = {
  textMatch: "dragDrop",
  textToImage: "textToImage",
  imageDropZones: "imageDropZones",
};

/**
 * @param {object} block
 */
function normalizeBlockType(block) {
  const raw = String(block.type || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return raw;
}

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function isDiagramActivityBlock(block) {
  const t = normalizeBlockType(block);
  const role = String(block.role || "").toLowerCase();
  if (DIAGRAM_ACTIVITY_TYPES.has(t)) return true;
  if (t === "diagram" && (block.mode === "step" || role === "step" || role === "label")) {
    return true;
  }
  return false;
}

function bulletList(items = []) {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

function dotList(items = []) {
  return items.map((item) => `• ${item}`).join("\n");
}

function getBlockPairs(block) {
  const pairs = Array.isArray(block?.pairs) ? block.pairs : [];
  return pairs
    .map((p, i) => ({
      id: safeStr(p?.id) || `pair-${i + 1}`,
      prompt: safeStr(p?.prompt) || safeStr(p?.label) || "",
      answer: safeStr(p?.answer) || safeStr(p?.definition) || "",
      imageUrl: safeStr(p?.imageUrl ?? p?.image_url),
    }))
    .filter((p) => p.prompt || p.answer);
}

function pairById(pairs, id) {
  return pairs.find((p) => p.id === id);
}

function splitHotspotLabel(h) {
  const parts = String(h).split(/\s*[—–-]\s*/);
  return {
    term: safeStr(parts[0]) || String(h),
    desc: safeStr(parts[1]) || "",
  };
}

function deriveCardsAndMatches(block, diagram) {
  const pairs = getBlockPairs(block);
  if (pairs.length) {
    const cards = pairs.map((p) => p.prompt).filter(Boolean);
    const matches = pairs.map((p) => p.answer).filter(Boolean);
    const correctMatches = pairs
      .filter((p) => p.prompt && p.answer)
      .map((p) => `${p.prompt} — ${p.answer}`);
    return { cards, matches, correctMatches };
  }
  if (diagram?.hotspots?.length) {
    const cards = [];
    const matches = [];
    const correctMatches = [];
    for (const h of diagram.hotspots) {
      const { term, desc } = splitHotspotLabel(h);
      cards.push(term);
      matches.push(desc || "Match on diagram");
      correctMatches.push(desc ? `${term} — ${desc}` : `Match: ${term}`);
    }
    return { cards, matches, correctMatches };
  }
  return {
    cards: ["Catabolism", "Anabolism", "ATP", "Respiration"],
    matches: [
      "Breaks down molecules",
      "Builds larger molecules",
      "Transfers energy",
      "Releases energy",
    ],
    correctMatches: [
      "Catabolism — breaks down molecules",
      "Anabolism — builds larger molecules",
      "ATP — transfers energy",
      "Respiration — releases energy",
    ],
  };
}

function deriveCommonMisconceptions() {
  return [
    "Metabolism is the same as digestion.",
    "ATP is 'energy made' rather than energy transferred.",
    "Catabolism and anabolism are confused (build vs break).",
  ];
}

function diagramImageType(diagram) {
  const t = safeStr(diagram?.type);
  if (/compare/i.test(t)) return "Compare Diagram";
  if (/flow|process/i.test(t)) return "Process Flow Diagram";
  if (/step/i.test(t)) return "Step-by-step Diagram";
  return t || "Labelled Diagram";
}

function deriveImageLayout(diagram) {
  const must = diagram?.mustShow || [];
  const left = must.find((s) => /side a|left|catabol/i.test(String(s)));
  const right = must.find((s) => /side b|right|anabol/i.test(String(s)));
  if (left && right) {
    return `Left = ${String(left).replace(/^side a:\s*/i, "").trim()}\nRight = ${String(right).replace(/^side b:\s*/i, "").trim()}`;
  }
  if (must.length >= 2) return `${must[0]}\n${must[1]}`;
  return "Two-panel compare layout — label each side clearly.";
}

function deriveVisualElements(diagram) {
  if (diagram?.mustShow?.length) {
    return diagram.mustShow.map((s) =>
      String(s)
        .replace(/arrow|→|icon|caption/gi, "")
        .trim()
    );
  }
  return ["Key labelled structures", "Process arrows", "ATP / energy transfer callout"];
}

function deriveRequiredLabels(block, diagram) {
  const pairs = getBlockPairs(block);
  const fromPairs = pairs.map((p) => p.prompt).filter(Boolean);
  if (fromPairs.length) return fromPairs;
  if (diagram?.hotspots?.length) {
    return diagram.hotspots.map((h) => splitHotspotLabel(h).term);
  }
  return ["Catabolism", "Anabolism", "ATP", "Glucose"];
}

function deriveHotspotList(block, diagram) {
  const pairs = getBlockPairs(block);
  if (pairs.length) {
    return pairs.map((p, i) => `${i + 1}. ${p.prompt || p.answer}`);
  }
  if (diagram?.hotspots?.length) {
    return diagram.hotspots.map((h, i) => `${i + 1}. ${h}`);
  }
  return ["1. Catabolism", "2. ATP release", "3. Anabolism", "4. ATP requirement"];
}

function describeDropZones(block, pairs) {
  const dz = Array.isArray(block?.dropZones) ? block.dropZones : [];
  if (!dz.length) {
    return deriveRequiredLabels(block, null).map((label, i) => `${i + 1}. ${label}`);
  }
  return dz.map((z, i) => {
    const pair = pairById(pairs, safeStr(z.correctPairId));
    const label = pair?.prompt || pair?.answer || `Zone ${i + 1}`;
    return `${i + 1}. ${label}`;
  });
}

function deriveDistractors(block, diagram, pairs) {
  const used = new Set(
    pairs.flatMap((p) => [p.prompt, p.answer].map((s) => s.toLowerCase()).filter(Boolean))
  );
  const fromHotspots = (diagram?.hotspots || [])
    .map((h) => splitHotspotLabel(h).term)
    .filter((h) => h && !used.has(h.toLowerCase()));
  if (fromHotspots.length) return fromHotspots.slice(0, 4);
  return ["Protein synthesis", "Urea", "Enzyme"];
}

function imageSpecification(diagram, activity) {
  if (diagram?.purpose) return diagram.purpose;
  return activity?.rationale || "Show key structures and labels teachers can place drop zones on.";
}

/**
 * @param {object} diagram
 */
function formatDiagramBrief(diagram) {
  const hotspots = (diagram.hotspots || []).map((h, i) => `${i + 1}. ${h}`);
  return [
    BRIEF_MARKER,
    "",
    "DIAGRAM BRIEF",
    "",
    `Title:\n${diagram.title || "Diagram"}`,
    "",
    `Purpose:\n${diagram.purpose || "Support GCSE understanding with a clear visual anchor."}`,
    "",
    `Must Show:\n${dotList(diagram.mustShow || [])}`,
    "",
    "Hotspots:",
    hotspots.length ? hotspots.join("\n") : "1. Key label\n2. Process step\n3. Exam-linked part",
    "",
    `Assessment Focus:\n${dotList(diagram.assessmentFocus || [])}`,
    "",
    "Student Task:",
    "Label or trace the pathways on the diagram.",
    "Explain how each labelled part earns marks in an exam answer.",
    "",
    "Do NOT use a placeholder image. Build this visual from the brief above.",
  ].join("\n");
}

/**
 * Standard text-column drag & drop (text match layout).
 * @param {object} activity
 * @param {object} [diagram]
 * @param {object} [block]
 */
function formatTextMatchBrief(activity, diagram, block = {}) {
  const { cards, matches, correctMatches } = deriveCardsAndMatches(block, diagram);
  const assessment = diagram?.assessmentFocus?.length
    ? diagram.assessmentFocus
    : ["Match terms to definitions", "Use precise GCSE vocabulary"];

  return [
    BRIEF_MARKER,
    "",
    "DRAG & DROP BRIEF",
    "",
    `Purpose:\n${activity?.rationale || diagram?.purpose || "Sort or match concepts using text cards."}`,
    "",
    "Cards:",
    dotList(cards),
    "",
    "Correct matches:",
    dotList(correctMatches.length ? correctMatches : matches),
    "",
    "Common misconceptions:",
    dotList(deriveCommonMisconceptions()),
    "",
    "Assessment focus:",
    dotList(assessment),
    "",
    "Student task:",
    "Drag each card to its correct match.",
    "",
    "Do NOT generate images. Teacher builds the card set from this brief.",
  ].join("\n");
}

/** @deprecated alias — use formatTextMatchBrief */
function formatDragDropBrief(activity, diagram, block) {
  return formatTextMatchBrief(activity, diagram, block);
}

/**
 * Text → image layout — one shared image with label hotspots.
 * @param {object} activity
 * @param {object} [diagram]
 * @param {object} [block]
 */
function formatTextToImageBrief(activity, diagram, block = {}) {
  const title = safeStr(block?.title) || diagram?.title || "Compare diagram";
  const assessment = diagram?.assessmentFocus?.length
    ? diagram.assessmentFocus
    : ["Compare key processes on one image"];

  return [
    BRIEF_MARKER,
    "",
    "TEXT → IMAGE DESIGN BRIEF",
    "",
    `Image Title:\n${title}`,
    "",
    `Image Type:\n${diagramImageType(diagram)}`,
    "",
    `Layout:\n${deriveImageLayout(diagram)}`,
    "",
    "Visual Elements:",
    dotList(deriveVisualElements(diagram)),
    "",
    "Required Labels:",
    dotList(deriveRequiredLabels(block, diagram)),
    "",
    "Hotspots:",
    deriveHotspotList(block, diagram).join("\n"),
    "",
    "Student Prompt:",
    "Drag the correct labels onto the image.",
    "",
    "Assessment Focus:",
    dotList(assessment),
    "",
    "Do NOT use a placeholder image. Create this single image from the specification above.",
  ].join("\n");
}

/**
 * Diagram image + drop zones layout.
 * @param {object} activity
 * @param {object} [diagram]
 * @param {object} [block]
 */
function formatImageDropZonesBrief(activity, diagram, block = {}) {
  const pairs = getBlockPairs(block);
  const title = safeStr(block?.title) || diagram?.title || "Diagram with drop zones";
  const assessment = diagram?.assessmentFocus?.length
    ? diagram.assessmentFocus
    : ["Place labels on the correct regions of the diagram"];

  return [
    BRIEF_MARKER,
    "",
    "IMAGE + DROP ZONES DESIGN BRIEF",
    "",
    `Image Title:\n${title}`,
    "",
    `Image Specification:\n${imageSpecification(diagram, activity)}`,
    "",
    "Drop Zone Locations:",
    describeDropZones(block, pairs).join("\n"),
    "",
    "Correct Answers:",
    "Map each label to the correct zone.",
    pairs.length
      ? dotList(
          pairs
            .filter((p) => p.prompt && p.answer)
            .map((p) => `${p.prompt} → ${p.answer}`)
        )
      : "",
    "",
    "Distractors:",
    dotList(deriveDistractors(block, diagram, pairs)),
    "",
    "Assessment Focus:",
    dotList(assessment),
    "",
    "Do NOT use a placeholder image. Build the diagram and zone targets from this brief.",
  ].join("\n");
}

/**
 * @param {object} diagram
 * @param {object} [activity]
 */
function formatStepByStepBrief(diagram, activity) {
  const steps = deriveSequenceSteps(diagram);
  return [
    BRIEF_MARKER,
    "",
    "STEP-BY-STEP BRIEF",
    "",
    `Title:\n${diagram?.title || "Process sequence"}`,
    "",
    "Sequence:",
    bulletList(steps),
    "",
    "Student Questions:",
    bulletList([
      "Where is ATP involved in this sequence?",
      "Why is ATP required for the steps that follow?",
      "How is energy transferred (not created) in this process?",
      diagram?.assessmentFocus?.[0] || "What would an examiner credit in your explanation?",
    ]),
    "",
    `Teaching note:\n${activity?.rationale || diagram?.purpose || ""}`,
    "",
    "Do NOT use placeholder step images. One clear visual per step or one multi-step board diagram.",
  ].join("\n");
}

function deriveSequenceSteps(diagram) {
  if (!diagram) {
    return [
      "Introduce the starting molecule",
      "Show the core process",
      "Show ATP / energy transfer",
      "Link to cell use or product",
    ];
  }
  const fromMustShow = diagram.mustShow || [];
  if (fromMustShow.length >= 3) {
    return fromMustShow.map((s, i) => `Step ${i + 1}: ${s}`);
  }
  return [
    "Glucose enters the pathway",
    "Respiration transfers energy",
    "ATP is available for cell reactions",
    "ATP powers anabolic / synthesis reactions",
  ];
}

/**
 * Pick diagram brief index for block type (consumes pool once).
 * @param {string} blockTypeNorm
 * @param {object[]} diagrams
 * @param {Set<number>} used
 * @param {object} [block]
 */
function pickDiagramForBlock(blockTypeNorm, diagrams, used, block) {
  const layout = block ? resolveDragDropActivityLayout(block) : null;
  const prefer = {
    interactivediagram: [/economy|summary|compare/i, /flow|glucose|atp/i, /deamination|urea/i],
    dragdropmatch: {
      textToImage: [/compare/i, /economy/i, /flow/i],
      imageDropZones: [/economy|summary/i, /flow|glucose|respiration|atp/i, /compare/i],
      textMatch: [/flow|glucose|respiration|atp/i, /economy|compare/i],
    },
    interactivesequence: [/flow|glucose|step|process/i, /deamination|urea/i, /economy/i],
    hotspot: [/economy|compare/i, /flow/i],
  };

  let patternGroups;
  if (blockTypeNorm === "dragdropmatch") {
    const key =
      layout === "textToImage"
        ? "textToImage"
        : layout === "imageDropZones"
          ? "imageDropZones"
          : "textMatch";
    patternGroups = prefer.dragdropmatch[key] || prefer.dragdropmatch.textMatch;
  } else {
    patternGroups = prefer[blockTypeNorm] || [[/./]];
  }

  for (const group of patternGroups) {
    const regs = Array.isArray(group) ? group : [group];
    for (let i = 0; i < diagrams.length; i++) {
      if (used.has(i)) continue;
      const d = diagrams[i];
      const hay = `${d.title} ${d.type} ${d.purpose}`;
      if (regs.some((re) => re.test(hay))) {
        used.add(i);
        return { diagram: d, index: i };
      }
    }
  }
  for (let i = 0; i < diagrams.length; i++) {
    if (!used.has(i)) {
      used.add(i);
      return { diagram: diagrams[i], index: i };
    }
  }
  return { diagram: null, index: -1 };
}

/**
 * @param {object} activities
 * @param {string} blockTypeNorm
 */
function findActivityForBlock(activities, blockTypeNorm) {
  const map = {
    dragdropmatch: [/drag/i, /drop/i, /match/i],
    interactivediagram: [/hotspot|label|diagram/i, /interactive/i],
    interactivesequence: [/sequenc/i, /step/i],
  };
  const patterns = map[blockTypeNorm] || [];
  for (const re of patterns) {
    const hit = activities.find((a) => re.test(a.activityType || ""));
    if (hit) return hit;
  }
  return activities[0] || null;
}

/**
 * @param {object} block
 * @param {object} ctx
 */
function buildBriefForBlock(block, ctx) {
  const typeNorm = normalizeBlockType(block);
  let diagramPick = pickDiagramForBlock(typeNorm, ctx.diagrams, ctx.usedDiagrams, block);
  const activity = findActivityForBlock(ctx.activities, typeNorm);

  if (typeNorm === "dragdropmatch") {
    const layout = resolveDragDropActivityLayout(block);
    const template =
      layout === "textToImage"
        ? "formatTextToImageBrief"
        : layout === "imageDropZones"
          ? "formatImageDropZonesBrief"
          : "formatTextMatchBrief";
    if (
      process.env.TEACHER_BRAIN_INJECTION_LOG === "1" ||
      process.env.NODE_ENV !== "production"
    ) {
      console.log("[TeacherBrainLayout] buildBriefForBlock", {
        matchMode: block.matchMode,
        dragDropLayout: block.dragDropLayout,
        activityLayout: block.activityLayout,
        resolved: layout,
        template,
      });
    }
    if (layout === "textToImage") {
      const compare = ctx.diagrams.find((d, i) => /compare/i.test(d.title) && !ctx.usedDiagrams.has(i));
      if (compare) {
        const idx = ctx.diagrams.indexOf(compare);
        if (idx >= 0) ctx.usedDiagrams.add(idx);
        diagramPick = { diagram: compare, index: idx };
      }
      return formatTextToImageBrief(activity, diagramPick.diagram, block);
    }
    if (layout === "imageDropZones") {
      const economy = ctx.diagrams.find(
        (d, i) => /economy|summary/i.test(d.title) && !ctx.usedDiagrams.has(i)
      );
      if (economy) {
        const idx = ctx.diagrams.indexOf(economy);
        if (idx >= 0) ctx.usedDiagrams.add(idx);
        diagramPick = { diagram: economy, index: idx };
      }
      return formatImageDropZonesBrief(activity, diagramPick.diagram, block);
    }
    const flow = ctx.diagrams.find((d, i) =>
      /glucose|respiration|atp/i.test(`${d.title} ${d.purpose}`)
    );
    if (flow) {
      const idx = ctx.diagrams.indexOf(flow);
      if (idx >= 0) ctx.usedDiagrams.add(idx);
      diagramPick = { diagram: flow, index: idx };
    }
    return formatTextMatchBrief(activity, diagramPick.diagram, block);
  }
  if (typeNorm === "interactivesequence") {
    const flow = ctx.diagrams.find((d) => /glucose|respiration|atp|step/i.test(`${d.title} ${d.type}`));
    const stepDiagram = flow || diagramPick.diagram;
    return formatStepByStepBrief(stepDiagram, activity);
  }
  return formatDiagramBrief(
    diagramPick.diagram || {
      title: block.title || "Interactive diagram",
      purpose: activity?.rationale || "Label and explain key structures.",
      mustShow: ["Key labels", "Process arrows", "Exam-linked annotation"],
      hotspots: ["Core label 1", "Core label 2", "Core label 3"],
      assessmentFocus: ["Describe", "Explain"],
    }
  );
}

/**
 * @param {object} block
 * @param {string} brief
 */
/** Teacher note text before any existing Teacher Brain brief (may be empty). */
function stripTeacherBrainBriefFromNote(note) {
  const trimmed = String(note ?? "").trim();
  if (!trimmed.includes(BRIEF_MARKER)) return trimmed;
  return trimmed.slice(0, trimmed.indexOf(BRIEF_MARKER)).trimEnd();
}

function replaceTeacherBrainBriefInNote(existing, brief) {
  const prefix = stripTeacherBrainBriefFromNote(existing);
  return prefix ? `${prefix}\n\n${brief}` : brief;
}

function injectBriefIntoBlock(block, brief) {
  if (!brief) return block;
  const out = { ...block, note: replaceTeacherBrainBriefInNote(block.note, brief) };
  if (!out.title && brief.includes("Title:\n")) {
    const m = brief.match(/Title:\n([^\n]+)/);
    if (m) out.title = m[1].trim();
  }
  return out;
}

/**
 * @param {object[]} pages
 * @param {object} brain — runTeacherBrain output
 */
function injectDiagramAndActivityBriefs(pages, brain) {
  if (!brain || !Array.isArray(pages)) {
    return { pages: pages || [], injections: [] };
  }

  const diagrams = brain.requiredDiagrams || [];
  const activities = brain.activityRecommendations || [];
  const injections = [];
  const usedDiagrams = new Set();

  if (!diagrams.length && !activities.length) {
    return { pages, injections };
  }

  const ctx = { diagrams, activities, usedDiagrams };

  const newPages = pages.map((page, pageIndex) => {
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const newBlocks = blocks.map((block, blockIndex) => {
      if (!isDiagramActivityBlock(block)) return block;
      const hadBrief = String(block.note || "").includes(BRIEF_MARKER);
      const brief = buildBriefForBlock(block, ctx);
      const injected = injectBriefIntoBlock(block, brief);
      const typeNorm = normalizeBlockType(block);
      let briefKind =
        typeNorm === "interactivesequence"
          ? "stepByStep"
          : typeNorm === "dragdropmatch"
            ? "dragDrop"
            : "diagram";
      if (typeNorm === "dragdropmatch") {
        const layout = resolveDragDropActivityLayout(block);
        briefKind = BRIEF_KIND_BY_LAYOUT[layout] || "dragDrop";
      }
      injections.push({
        pageIndex,
        blockIndex,
        blockType: TYPE_ALIASES[typeNorm] || block.type,
        briefKind,
        regenerated: hadBrief,
        activityLayout:
          typeNorm === "dragdropmatch" ? resolveDragDropActivityLayout(block) : undefined,
      });
      return injected;
    });
    return { ...page, blocks: newBlocks };
  });

  return { pages: newPages, injections };
}

module.exports = {
  BRIEF_MARKER,
  DIAGRAM_ACTIVITY_TYPES,
  isDiagramActivityBlock,
  formatDiagramBrief,
  formatDragDropBrief,
  formatTextMatchBrief,
  formatTextToImageBrief,
  formatImageDropZonesBrief,
  formatStepByStepBrief,
  resolveDragDropActivityLayout,
  stripTeacherBrainBriefFromNote,
  replaceTeacherBrainBriefInNote,
  injectDiagramAndActivityBriefs,
};

