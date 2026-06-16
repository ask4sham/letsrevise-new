/**
 * P3.0E — Map a lesson diagram/activity block + lesson context to DiagramSpecification.
 * Rule-based only — no LLM calls. Briefs follow the activity contract, not generic topics.
 */
const { SCHEMA_VERSION } = require("./schema");
const { ANSWER_ON_IMAGE_MODES } = require("./activityBriefRules");

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

function isLetterHotspotId(id) {
  return /^[A-Z]$/.test(safeStr(id));
}

function getActivityInstruction(block) {
  return (
    safeStr(block?.instructions) ||
    safeStr(block?.studentTask) ||
    safeStr(block?.intro) ||
    safeStr(block?.subtitle)
  );
}

function getStudentTask(block) {
  return safeStr(block?.studentTask) || safeStr(block?.instructions);
}

function inferImageMustShow(block, lesson, page) {
  const parts = [];
  const hay = [
    block?.instructions,
    block?.studentTask,
    block?.title,
    block?.intro,
    block?.caption,
    lesson?.topic,
    lesson?.subTopic,
    lesson?.subtopic,
    page?.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (hay.includes("ruler") || hay.includes("ruler-drop") || hay.includes("ruler drop")) {
    parts.push(
      "Ruler-drop required practical setup: dropper hand holding vertical cm ruler, catcher hand ready below, clear drop distance context."
    );
    parts.push("Nervous pathway diagram linked to the ruler-drop response (not a generic nervous system overview).");
  }
  if (hay.includes("delay")) {
    parts.push("Visual context so students can explain where delay can occur in the nervous pathway.");
  }
  if (hay.includes("reflex")) {
    parts.push("Reflex arc pathway showing stimulus → receptor → CNS → effector → response.");
  }
  if (hay.includes("brain") && (hay.includes("region") || hay.includes("function"))) {
    parts.push("Sagittal brain diagram with distinct colour-highlighted regions for drag-and-drop matching.");
  }
  if (hay.includes("reaction time") || hay.includes("required practical")) {
    parts.push("Required practical context appropriate to the reaction time investigation.");
  }
  if (hay.includes("photosynthesis")) {
    parts.push("Photosynthesis equation context with chloroplast, inputs and outputs clearly shown.");
  }

  if (!parts.length && safeStr(block?.caption)) {
    parts.push(safeStr(block.caption));
  }

  return parts.join(" ");
}

function inferHotspotLabelActivity(block, hotspots) {
  if (hotspots.length < 2) return false;
  const allLetters = hotspots.every((h) => isLetterHotspotId(h.id));
  const hay = `${block?.instructions || ""} ${block?.intro || ""} ${block?.studentTask || ""}`.toLowerCase();
  const mentionsLabel = /label|name the|identify where|drag each label|match each label|explain where/i.test(hay);
  return allLetters && mentionsLabel;
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
  lines.push("");
  for (let i = 1; i <= count; i += 1) {
    const overlay = complexAnatomy ? ` + matching ${i} beside overlay row` : "";
    lines.push(`Numbered hotspot ${i} on Region ${i}${overlay}`);
  }
  return lines;
}

function buildLetterHotspotImageElements(block, lesson, page, hotspots) {
  const lines = [];
  const context = inferImageMustShow(block, lesson, page);
  if (context) {
    for (const sentence of context.split(/(?<=\.)\s+/).filter(Boolean)) {
      lines.push(sentence.trim());
    }
    lines.push("");
  }
  for (const h of hotspots) {
    lines.push(`Hotspot marker ${h.id} on the correct pathway stage (letter only)`);
  }
  return lines;
}

function buildDragDropImageElements(pairs, structureToFunction, complexAnatomy) {
  if (structureToFunction) return buildRegionImageElements(pairs.length, complexAnatomy);
  return pairs
    .map((_, i) => `Region ${i + 1} highlighted`)
    .concat(pairs.map((_, i) => `Numbered hotspot ${i + 1} on Region ${i + 1}`));
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
  const activityInstruction = getActivityInstruction(block);
  const imageMustShow = inferImageMustShow(block, lesson, page);
  const haystack = `${topic} ${subtopic} ${title} ${activityInstruction}`;
  const complexAnatomy = isComplexAnatomyTopic(haystack);
  const structureToFunction = inferStructureToFunction(pairs);
  const matchMode = resolveDragDropMatchMode(block);
  const activityPedagogyType = structureToFunction
    ? "structure-to-function"
    : "label-to-structure";

  const labels = pairs.map((p, i) => {
    const structureText = structureToFunction ? p.answer : p.prompt || p.answer;
    const id = slugify(structureText, `label-${i + 1}`);
    return {
      id,
      text: structureToFunction ? toUpperLabel(structureText) : toUpperLabel(structureText),
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

  const imageElements = buildDragDropImageElements(pairs, structureToFunction, complexAnatomy);
  const interactionTypes = ["view", "hotspot", "drag-drop"];
  if (matchMode === "text-to-image") interactionTypes.push("tti");

  const examFocus = [
    activityInstruction || `Complete the ${title} drag-and-drop activity`,
    structureToFunction ? "Match each function to the correct numbered region" : "Match each card to the correct diagram region",
  ].filter(Boolean);

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
      learningGoal: activityInstruction || `Students complete the ${title} drag-and-drop diagram activity.`,
      diagramType: "hotspot",
      interactionTypes,
      activityPedagogyType,
      imageElements,
      conceptCards,
      title,
      instruction: imageMustShow || undefined,
      examFocus,
      difficulty: normalizeDifficulty(tier),
      activityBrief: {
        sourceBlockType: "dragDropMatch",
        activityInstruction: activityInstruction || undefined,
        imageMustShow: imageMustShow || undefined,
        studentTask: getStudentTask(block) || undefined,
        answerOnImage: structureToFunction ? "region-ids" : "overlay-cards",
      },
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
  const activityInstruction = getActivityInstruction(block);
  const imageMustShow = inferImageMustShow(block, lesson, page);
  const letterLabelActivity = inferHotspotLabelActivity(block, hotspots);

  if (letterLabelActivity) {
    const conceptCards = hotspots.map((h) => h.label);
    const imageElements = buildLetterHotspotImageElements(block, lesson, page, hotspots);
    const labels = hotspots.map((h, i) => ({
      id: slugify(h.label, `hotspot-${i + 1}`),
      text: h.id.toUpperCase(),
      role: "structure",
      order: i + 1,
      required: true,
      hotspotId: h.id,
      mapsTo: h.label,
      description: h.description || undefined,
    }));

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
        learningGoal: activityInstruction,
        diagramType: "hotspot",
        interactionTypes: ["view", "hotspot", "label-overlay"],
        activityPedagogyType: "label-to-structure",
        imageElements,
        conceptCards,
        title,
        instruction: imageMustShow || undefined,
        examFocus: [
          activityInstruction,
          "Identify where delay or processing occurs in the pathway",
        ].filter(Boolean),
        difficulty: normalizeDifficulty(tier),
        activityBrief: {
          sourceBlockType: "interactiveDiagram",
          activityInstruction,
          imageMustShow: imageMustShow || undefined,
          studentTask: getStudentTask(block) || undefined,
          answerOnImage: "letters-only",
        },
        labels,
        layout: {
          orientation: "landscape",
          flow: "left-to-right",
          processType: "pathway-labelling",
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

  const labels = hotspots.map((h, i) => {
    const id = slugify(h.label, `hotspot-${i + 1}`);
    return {
      id,
      text: toUpperLabel(h.label),
      role: "structure",
      order: i + 1,
      required: true,
      hotspotId: h.id,
      mapsTo: h.label,
      description: h.description || undefined,
    };
  });

  const examFocus = hotspots.map((h) => `${h.id}: ${h.label}${h.description ? ` — ${h.description}` : ""}`);

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
      learningGoal: activityInstruction || `Students can explain each hotspot on the ${title} diagram.`,
      diagramType: "hotspot",
      interactionTypes: ["view", "hotspot"],
      title,
      instruction: imageMustShow || `Interactive diagram for ${title}. Each hotspot represents: ${hotspots.map((h) => `${h.id} = ${h.label}`).join("; ")}.`,
      examFocus,
      difficulty: normalizeDifficulty(tier),
      activityBrief: {
        sourceBlockType: "interactiveDiagram",
        activityInstruction: activityInstruction || undefined,
        imageMustShow: imageMustShow || undefined,
        studentTask: getStudentTask(block) || undefined,
        answerOnImage: "full-labels",
      },
      labels,
      layout: {
        orientation: "landscape",
        flow: "left-to-right",
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
  const activityInstruction = getActivityInstruction(block);
  const imageMustShow = inferImageMustShow(block, lesson, page);
  const annotations = Array.isArray(block?.annotations) ? block.annotations : [];
  const labelTexts = annotations.map((a) => safeStr(a?.text)).filter(Boolean);

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

  const instructionParts = [imageMustShow, caption, subtitle].filter(Boolean);

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
      learningGoal: activityInstruction || subtitle || caption || `Students can interpret the ${title} diagram.`,
      diagramType: "labelled",
      interactionTypes: ["view"],
      title,
      instruction: instructionParts.join(" ") || undefined,
      examFocus: activityInstruction ? [activityInstruction] : undefined,
      difficulty: normalizeDifficulty(tier),
      activityBrief: {
        sourceBlockType: "diagram",
        activityInstruction: activityInstruction || undefined,
        imageMustShow: imageMustShow || caption || undefined,
        studentTask: safeStr(block?.studentTask) || undefined,
        answerOnImage: "full-labels",
      },
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
  ANSWER_ON_IMAGE_MODES,
};
