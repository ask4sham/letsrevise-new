/**
 * P3.0C — Map a lesson diagram/activity block + lesson context to DiagramSpecification.
 * Rule-based only — no LLM calls.
 */
const { SCHEMA_VERSION } = require("./schema");

function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v).trim();
  return s || fallback;
}

function slugify(text, fallback = "diagram") {
  const slug = safeStr(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

function normalizeBlockType(block) {
  return safeStr(block?.type).toLowerCase().replace(/[\s_-]+/g, "");
}

function normalizeExamBoard(board) {
  const b = safeStr(board, "AQA");
  const upper = b.toUpperCase();
  if (upper.startsWith("AQA")) return "AQA";
  if (upper.startsWith("EDEXCEL")) return "Edexcel";
  if (upper.startsWith("OCR")) return "OCR";
  if (upper.startsWith("WJEC")) return "WJEC";
  if (upper.startsWith("CCEA")) return "CCEA";
  return "Other";
}

function normalizeTier(tier, level) {
  const t = safeStr(tier || level).toLowerCase();
  if (t.includes("foundation") || t === "f") return "Foundation";
  return "Higher";
}

function normalizeSubject(subject, level) {
  const raw = safeStr(subject) || safeStr(level) || "GCSE Biology";
  return raw.toLowerCase().startsWith("gcse") ? raw : `GCSE ${raw}`;
}

function normalizeDifficulty(tier) {
  return tier === "Foundation" ? "foundation" : "higher";
}

function toUpperLabel(text) {
  return safeStr(text).toUpperCase();
}

function isComplexAnatomyTopic(haystack) {
  const hay = haystack.toLowerCase();
  return ["brain", "eye", "heart", "nephron", "reflex", "endocrine", "hormonal"].some((t) =>
    hay.includes(t)
  );
}

function getPairs(block) {
  return (Array.isArray(block?.pairs) ? block.pairs : [])
    .map((p, i) => ({
      id: safeStr(p?.id) || `pair-${i + 1}`,
      prompt: safeStr(p?.prompt),
      answer: safeStr(p?.answer),
    }))
    .filter((p) => p.prompt || p.answer);
}

function getHotspots(block) {
  return (Array.isArray(block?.hotspots) ? block.hotspots : [])
    .map((h, i) => ({
      id: safeStr(h?.id) || String(i + 1),
      label: safeStr(h?.label),
      description: safeStr(h?.description || h?.explanation),
    }))
    .filter((h) => h.label || h.description);
}

function resolveDragDropMatchMode(block) {
  const raw = block?.matchMode ?? block?.dragDropLayout ?? block?.activityLayout ?? "";
  const s = safeStr(raw).toLowerCase().replace(/[\s_]+/g, "-");
  if (s === "diagram") return "diagram";
  if (s === "text-to-image" || s === "texttoimage" || s === "text-image") return "text-to-image";
  if (s === "text" || s === "standard") return "text";
  if (block?.imageUrl || block?.dropZones?.length) return "diagram";
  return "text";
}

function inferStructureToFunction(pairs) {
  if (pairs.length < 2) return false;
  const answers = pairs.map((p) => p.answer);
  const prompts = pairs.map((p) => p.prompt);
  if (answers.some((a) => !a) || prompts.some((p) => !p)) return false;
  const avgAnswerLen = answers.reduce((n, a) => n + a.length, 0) / answers.length;
  const avgPromptLen = prompts.reduce((n, p) => n + p.length, 0) / prompts.length;
  return avgPromptLen > avgAnswerLen + 4;
}

function buildRegionImageElements(count, complexAnatomy) {
  const lines = [];
  for (let i = 1; i <= count; i += 1) {
    lines.push(`Region ${i} highlighted`);
  }
  for (let i = 1; i <= count; i += 1) {
    const overlay = complexAnatomy ? ` + matching ${i} beside overlay row` : "";
    lines.push(`Numbered hotspot ${i} on Region ${i}${overlay}`);
  }
  return lines;
}

function buildDragDropDiagramSpec(block, lesson, page) {
  const pairs = getPairs(block);
  if (pairs.length < 2) {
    return { ok: false, errors: [{ path: "block.pairs", message: "At least 2 pairs required", code: "PAIRS_REQUIRED" }] };
  }

  const tier = normalizeTier(lesson?.tier, lesson?.level);
  const topic = safeStr(lesson?.subTopic || lesson?.subtopic || lesson?.topic, "Lesson topic");
  const subtopic = safeStr(page?.title) || safeStr(lesson?.subTopic || lesson?.subtopic);
  const title = safeStr(block?.title, safeStr(page?.title, "Diagram activity"));
  const haystack = `${topic} ${subtopic} ${title}`;
  const complexAnatomy = isComplexAnatomyTopic(haystack);
  const structureToFunction = inferStructureToFunction(pairs);
  const matchMode = resolveDragDropMatchMode(block);
  const activityPedagogyType = structureToFunction
    ? "structure-to-function"
    : matchMode === "text-to-image"
      ? "label-to-structure"
      : "label-to-structure";

  const labels = pairs.map((p, i) => {
    const structureText = structureToFunction ? p.answer : p.prompt || p.answer;
    const id = slugify(structureText, `label-${i + 1}`);
    return {
      id,
      text: toUpperLabel(structureText),
      role: "structure",
      order: i + 1,
      required: true,
      hotspotId: String(i + 1),
      mapsTo: structureToFunction ? p.prompt : p.answer,
    };
  });

  const conceptCards = structureToFunction
    ? pairs.map((p) => p.prompt)
    : pairs.map((p) => p.prompt || p.answer);

  const imageElements = structureToFunction
    ? buildRegionImageElements(pairs.length, complexAnatomy)
    : pairs.map((p, i) => `Region ${i + 1} highlighted`).concat(
        pairs.map((_, i) => `Numbered hotspot ${i + 1} on Region ${i + 1}`)
      );

  const interactionTypes = ["view", "hotspot", "drag-drop"];
  if (matchMode === "text-to-image") interactionTypes.push("tti");

  return {
    ok: true,
    spec: {
      schemaVersion: SCHEMA_VERSION,
      id: slugify(`${topic}-${title}`, "drag-drop-diagram"),
      subject: normalizeSubject(lesson?.subject, lesson?.level),
      examBoard: normalizeExamBoard(lesson?.board),
      tier,
      topic: safeStr(lesson?.topic, topic),
      subtopic: subtopic || undefined,
      learningGoal:
        safeStr(block?.instructions) ||
        safeStr(block?.studentTask) ||
        `Students can match items in the ${title} activity.`,
      diagramType: "hotspot",
      interactionTypes,
      activityPedagogyType,
      imageElements,
      conceptCards,
      title,
      instruction:
        structureToFunction
          ? `Diagram with ${pairs.length} colour-highlighted regions. Numbered markers only — no structure or function text on the image.`
          : `Diagram with ${pairs.length} numbered regions for a drag-and-drop matching activity.`,
      examFocus: structureToFunction
        ? ["Match structures to functions"]
        : ["Match labels to diagram regions"],
      difficulty: normalizeDifficulty(tier),
      labels,
      layout: {
        orientation: "landscape",
        flow: "left-to-right",
        processType: complexAnatomy ? "anatomy-regions" : "labelled-regions",
        composition: complexAnatomy ? "single-panel-with-rail" : "single-panel",
        regions: complexAnatomy ? ["diagram-panel", "overlay-rail"] : ["diagram-panel"],
        complexAnatomy,
      },
      activities: {
        hotspots: labels.map((l, i) => ({
          id: String(i + 1),
          labelId: l.id,
          region: "diagram-panel",
        })),
        dragDrop: pairs.map((p, i) => ({
          pairId: p.id,
          prompt: conceptCards[i],
          labelId: labels[i].id,
        })),
      },
      visualStyle: {
        examDiagram: true,
        whiteBackground: true,
        flatVector: true,
        highContrast: true,
        uppercaseLabels: true,
        minimalColour: true,
        letsReviseFrame: true,
      },
      status: "draft",
    },
  };
}

function buildInteractiveDiagramSpec(block, lesson, page) {
  const hotspots = getHotspots(block);
  if (hotspots.length < 1) {
    return {
      ok: false,
      errors: [{ path: "block.hotspots", message: "At least 1 hotspot required", code: "HOTSPOTS_REQUIRED" }],
    };
  }

  const tier = normalizeTier(lesson?.tier, lesson?.level);
  const topic = safeStr(lesson?.topic, "Lesson topic");
  const title = safeStr(block?.title, safeStr(page?.title, "Interactive diagram"));

  const labels = hotspots.map((h, i) => {
    const id = slugify(h.label, `hotspot-${i + 1}`);
    return {
      id,
      text: toUpperLabel(h.label),
      role: "structure",
      order: i + 1,
      required: true,
      hotspotId: h.id,
      description: h.description || undefined,
    };
  });

  return {
    ok: true,
    spec: {
      schemaVersion: SCHEMA_VERSION,
      id: slugify(`${topic}-${title}`, "interactive-diagram"),
      subject: normalizeSubject(lesson?.subject, lesson?.level),
      examBoard: normalizeExamBoard(lesson?.board),
      tier,
      topic,
      subtopic: safeStr(page?.title) || undefined,
      learningGoal:
        safeStr(block?.intro) ||
        safeStr(block?.instructions) ||
        `Students can identify labelled structures on the ${title} diagram.`,
      diagramType: "hotspot",
      interactionTypes: ["view", "hotspot"],
      title,
      instruction: `Interactive diagram with clearly distinct labelled regions for: ${labels.map((l) => l.text).join(", ")}.`,
      labels,
      layout: {
        orientation: "landscape",
        flow: "none",
        processType: "labelled-regions",
        composition: "single-panel",
        regions: ["diagram-panel"],
      },
      activities: {
        hotspots: labels.map((l) => ({
          id: l.hotspotId,
          labelId: l.id,
          region: "diagram-panel",
        })),
      },
      visualStyle: {
        examDiagram: true,
        whiteBackground: true,
        flatVector: true,
        highContrast: true,
        uppercaseLabels: true,
        minimalColour: true,
        letsReviseFrame: true,
      },
      status: "draft",
    },
  };
}

function buildStaticDiagramSpec(block, lesson, page) {
  const tier = normalizeTier(lesson?.tier, lesson?.level);
  const topic = safeStr(lesson?.topic, "Lesson topic");
  const title = safeStr(block?.title, safeStr(block?.caption, safeStr(page?.title, "Diagram")));
  const caption = safeStr(block?.caption);
  const subtitle = safeStr(block?.subtitle);
  const annotations = Array.isArray(block?.annotations) ? block.annotations : [];
  const labelTexts = annotations
    .map((a) => safeStr(a?.text))
    .filter(Boolean);

  const labels =
    labelTexts.length > 0
      ? labelTexts.map((text, i) => ({
          id: slugify(text, `label-${i + 1}`),
          text: toUpperLabel(text),
          role: "structure",
          order: i + 1,
          required: true,
        }))
      : [
          {
            id: "main-label",
            text: toUpperLabel(title),
            role: "structure",
            order: 1,
            required: true,
          },
        ];

  return {
    ok: true,
    spec: {
      schemaVersion: SCHEMA_VERSION,
      id: slugify(`${topic}-${title}`, "static-diagram"),
      subject: normalizeSubject(lesson?.subject, lesson?.level),
      examBoard: normalizeExamBoard(lesson?.board),
      tier,
      topic,
      subtopic: safeStr(page?.title) || undefined,
      learningGoal:
        subtitle ||
        caption ||
        `Students can interpret the ${title} diagram.`,
      diagramType: "labelled",
      interactionTypes: ["view"],
      title,
      instruction:
        caption ||
        subtitle ||
        `Clear labelled GCSE diagram for ${topic}.`,
      labels,
      layout: {
        orientation: "landscape",
        flow: "none",
        processType: "labelled",
        composition: "single-panel",
        regions: ["diagram-panel"],
      },
      visualStyle: {
        examDiagram: true,
        whiteBackground: true,
        flatVector: true,
        highContrast: true,
        uppercaseLabels: true,
        minimalColour: true,
        letsReviseFrame: true,
      },
      status: "draft",
    },
  };
}

/**
 * @param {object} block
 * @param {object} lesson
 * @param {object} [page]
 */
function lessonBlockToDiagramSpec(block, lesson = {}, page = {}) {
  if (!block || typeof block !== "object") {
    return { ok: false, errors: [{ path: "block", message: "block is required", code: "BLOCK_REQUIRED" }] };
  }

  const type = normalizeBlockType(block);
  if (type === "dragdropmatch") return buildDragDropDiagramSpec(block, lesson, page);
  if (type === "interactivediagram") return buildInteractiveDiagramSpec(block, lesson, page);
  if (type === "diagram") return buildStaticDiagramSpec(block, lesson, page);

  return {
    ok: false,
    errors: [
      {
        path: "block.type",
        message: `Unsupported block type for diagram brief: ${safeStr(block.type) || "(missing)"}`,
        code: "UNSUPPORTED_BLOCK_TYPE",
      },
    ],
  };
}

module.exports = {
  lessonBlockToDiagramSpec,
};
