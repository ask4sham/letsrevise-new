/**
 * P3.0A — Diagram Specification validator.
 * Returns { ok, errors, normalized } — no throws for invalid input.
 */
const {
  SCHEMA_VERSION,
  DIAGRAM_TYPES,
  INTERACTION_TYPES,
  ACTIVITY_PEDAGOGY_TYPES,
  DIFFICULTY_LEVELS,
  EXAM_BOARDS,
  ORIENTATIONS,
  FLOW_DIRECTIONS,
  LABEL_ROLES,
} = require("./schema");

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function isNonEmptyString(v) {
  return safeStr(v).length > 0;
}

function pushError(errors, path, message, code) {
  errors.push({ path, message, code });
}

function normalizeTier(tier) {
  const t = safeStr(tier);
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower === "foundation") return "Foundation";
  if (lower === "higher") return "Higher";
  return t;
}

/**
 * @param {unknown} input
 * @param {{ strict?: boolean }} [opts] — strict=true rejects unknown top-level keys
 * @returns {{ ok: boolean, errors: Array<{ path: string, message: string, code: string }>, normalized: import("./schema").DiagramSpecification | null }}
 */
function validateDiagramSpecification(input, opts = {}) {
  const errors = [];
  const strict = Boolean(opts.strict);

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: [{ path: "", message: "Specification must be a plain object", code: "INVALID_TYPE" }],
      normalized: null,
    };
  }

  /** @type {Record<string, unknown>} */
  const spec = input;

  if (strict) {
    const allowed = new Set([
      "schemaVersion",
      "id",
      "subject",
      "examBoard",
      "tier",
      "topic",
      "subtopic",
      "learningGoal",
      "diagramType",
      "interactionTypes",
      "activityPedagogyType",
      "imageElements",
      "conceptCards",
      "title",
      "instruction",
      "examFocus",
      "difficulty",
      "teacherNotes",
      "labels",
      "layout",
      "activities",
      "visualStyle",
      "status",
    ]);
    for (const key of Object.keys(spec)) {
      if (!allowed.has(key)) {
        pushError(errors, key, `Unknown field "${key}"`, "UNKNOWN_FIELD");
      }
    }
  }

  const schemaVersion = safeStr(spec.schemaVersion);
  if (schemaVersion !== SCHEMA_VERSION) {
    pushError(errors, "schemaVersion", `Must be "${SCHEMA_VERSION}"`, "INVALID_SCHEMA_VERSION");
  }

  const id = safeStr(spec.id);
  if (!id) pushError(errors, "id", "id is required", "REQUIRED");
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    pushError(errors, "id", "id must be a lowercase slug (e.g. reflex-arc)", "INVALID_ID");
  }

  for (const field of ["subject", "topic", "learningGoal", "title"]) {
    if (!isNonEmptyString(spec[field])) {
      pushError(errors, field, `${field} is required`, "REQUIRED");
    }
  }

  const examBoard = safeStr(spec.examBoard);
  if (!examBoard) pushError(errors, "examBoard", "examBoard is required", "REQUIRED");
  else if (!EXAM_BOARDS.includes(examBoard)) {
    pushError(errors, "examBoard", `Must be one of: ${EXAM_BOARDS.join(", ")}`, "INVALID_ENUM");
  }

  const tier = normalizeTier(spec.tier);
  if (!tier) pushError(errors, "tier", "tier is required (Foundation or Higher)", "REQUIRED");
  else if (!["Foundation", "Higher"].includes(tier)) {
    pushError(errors, "tier", "tier must be Foundation or Higher", "INVALID_ENUM");
  }

  const diagramType = safeStr(spec.diagramType);
  if (!diagramType) pushError(errors, "diagramType", "diagramType is required", "REQUIRED");
  else if (!DIAGRAM_TYPES.includes(diagramType)) {
    pushError(errors, "diagramType", `Must be one of: ${DIAGRAM_TYPES.join(", ")}`, "INVALID_ENUM");
  }

  const interactionTypes = Array.isArray(spec.interactionTypes) ? spec.interactionTypes : [];
  const needsPedagogyType = interactionTypes.some((t) => ["drag-drop", "tti"].includes(safeStr(t)));
  const activityPedagogyType = spec.activityPedagogyType != null ? safeStr(spec.activityPedagogyType) : "";

  if (needsPedagogyType && !activityPedagogyType) {
    pushError(
      errors,
      "activityPedagogyType",
      "activityPedagogyType is required when interactionTypes includes drag-drop or tti",
      "REQUIRED"
    );
  }
  if (activityPedagogyType && !ACTIVITY_PEDAGOGY_TYPES.includes(activityPedagogyType)) {
    pushError(
      errors,
      "activityPedagogyType",
      `Must be one of: ${ACTIVITY_PEDAGOGY_TYPES.join(", ")}`,
      "INVALID_ENUM"
    );
  }

  const imageElements = Array.isArray(spec.imageElements)
    ? spec.imageElements.map(safeStr).filter(Boolean)
    : [];
  const conceptCards = Array.isArray(spec.conceptCards)
    ? spec.conceptCards.map(safeStr).filter(Boolean)
    : [];

  if (activityPedagogyType) {
    if (imageElements.length < 2) {
      pushError(
        errors,
        "imageElements",
        "At least two imageElements required for pedagogy-driven drag-and-drop specs",
        "REQUIRED"
      );
    }
    if (conceptCards.length < 2) {
      pushError(
        errors,
        "conceptCards",
        "At least two conceptCards required for pedagogy-driven drag-and-drop specs",
        "REQUIRED"
      );
    }
  }

  if (interactionTypes.length === 0) {
    pushError(errors, "interactionTypes", "At least one interaction type is required", "REQUIRED");
  } else {
    for (let i = 0; i < interactionTypes.length; i++) {
      const it = safeStr(interactionTypes[i]);
      if (!INTERACTION_TYPES.includes(it)) {
        pushError(errors, `interactionTypes[${i}]`, `Invalid interaction type "${it}"`, "INVALID_ENUM");
      }
    }
    if (new Set(interactionTypes.map(safeStr)).size !== interactionTypes.length) {
      pushError(errors, "interactionTypes", "interactionTypes must be unique", "DUPLICATE");
    }
  }

  const difficulty = spec.difficulty != null ? safeStr(spec.difficulty) : "standard";
  if (difficulty && !DIFFICULTY_LEVELS.includes(difficulty)) {
    pushError(errors, "difficulty", `Must be one of: ${DIFFICULTY_LEVELS.join(", ")}`, "INVALID_ENUM");
  }

  const examFocus = Array.isArray(spec.examFocus) ? spec.examFocus.map(safeStr).filter(Boolean) : [];

  const labels = Array.isArray(spec.labels) ? spec.labels : [];
  if (labels.length === 0) {
    pushError(errors, "labels", "At least one label is required", "REQUIRED");
  }

  const labelIds = new Set();
  const hotspotIds = new Set();
  /** @type {import("./schema").DiagramSpecLabel[]} */
  const normalizedLabels = [];

  for (let i = 0; i < labels.length; i++) {
    const raw = labels[i];
    const path = `labels[${i}]`;
    if (!raw || typeof raw !== "object") {
      pushError(errors, path, "Label must be an object", "INVALID_TYPE");
      continue;
    }
    const labelId = safeStr(raw.id);
    const text = safeStr(raw.text);
    if (!labelId) pushError(errors, `${path}.id`, "Label id is required", "REQUIRED");
    if (!text) pushError(errors, `${path}.text`, "Label text is required", "REQUIRED");
    if (labelId && labelIds.has(labelId)) {
      pushError(errors, `${path}.id`, `Duplicate label id "${labelId}"`, "DUPLICATE");
    }
    if (labelId) labelIds.add(labelId);

    const role = raw.role != null ? safeStr(raw.role) : "structure";
    if (role && !LABEL_ROLES.includes(role)) {
      pushError(errors, `${path}.role`, `Invalid role "${role}"`, "INVALID_ENUM");
    }

    const hotspotId = raw.hotspotId != null ? safeStr(raw.hotspotId) : "";
    if (hotspotId) {
      if (hotspotIds.has(hotspotId)) {
        pushError(errors, `${path}.hotspotId`, `Duplicate hotspotId "${hotspotId}"`, "DUPLICATE");
      }
      hotspotIds.add(hotspotId);
    }

    normalizedLabels.push({
      id: labelId,
      text,
      role: role || "structure",
      order: typeof raw.order === "number" ? raw.order : undefined,
      required: raw.required !== false,
      examinable: raw.examinable !== false,
      mapsTo: raw.mapsTo != null ? safeStr(raw.mapsTo) : undefined,
      hotspotId: hotspotId || undefined,
      description: raw.description != null ? safeStr(raw.description) : undefined,
    });
  }

  const layout = spec.layout && typeof spec.layout === "object" ? spec.layout : {};
  const orientation = safeStr(layout.orientation);
  if (!orientation) pushError(errors, "layout.orientation", "layout.orientation is required", "REQUIRED");
  else if (!ORIENTATIONS.includes(orientation)) {
    pushError(errors, "layout.orientation", `Must be one of: ${ORIENTATIONS.join(", ")}`, "INVALID_ENUM");
  }

  const flow = layout.flow != null ? safeStr(layout.flow) : undefined;
  if (flow && !FLOW_DIRECTIONS.includes(flow)) {
    pushError(errors, "layout.flow", `Must be one of: ${FLOW_DIRECTIONS.join(", ")}`, "INVALID_ENUM");
  }

  /** @type {import("./schema").DiagramSpecLayout} */
  const normalizedLayout = {
    orientation,
    flow: flow || undefined,
    processType: layout.processType != null ? safeStr(layout.processType) : undefined,
    composition: layout.composition != null ? safeStr(layout.composition) : undefined,
    regions: Array.isArray(layout.regions)
      ? layout.regions.map(safeStr).filter(Boolean)
      : undefined,
    complexAnatomy: layout.complexAnatomy === true ? true : undefined,
  };

  // Diagram-type-specific rules
  if (diagramType === "process" || diagramType === "flowchart") {
    const ordered = normalizedLabels.filter((l) => typeof l.order === "number");
    if (ordered.length < 2) {
      pushError(
        errors,
        "labels",
        `${diagramType} diagrams should have at least two labels with order`,
        "DIAGRAM_TYPE_RULE"
      );
    }
  }

  if (diagramType === "hotspot" && !interactionTypes.includes("hotspot")) {
    pushError(
      errors,
      "interactionTypes",
      "hotspot diagramType should include interaction type \"hotspot\"",
      "DIAGRAM_TYPE_RULE"
    );
  }

  if (
    (diagramType === "practical-setup" || interactionTypes.includes("drag-drop")) &&
    normalizedLabels.filter((l) => l.required).length < 2
  ) {
    pushError(errors, "labels", "Practical/drag-drop specs need at least two required labels", "DIAGRAM_TYPE_RULE");
  }

  // Activities cross-check
  const activities = spec.activities && typeof spec.activities === "object" ? spec.activities : {};
  /** @type {import("./schema").DiagramSpecActivities} */
  const normalizedActivities = {};

  if (Array.isArray(activities.hotspots)) {
    normalizedActivities.hotspots = [];
    for (let i = 0; i < activities.hotspots.length; i++) {
      const h = activities.hotspots[i];
      const hp = `activities.hotspots[${i}]`;
      if (!h || typeof h !== "object") {
        pushError(errors, hp, "Hotspot seed must be an object", "INVALID_TYPE");
        continue;
      }
      const hid = safeStr(h.id);
      const labelId = safeStr(h.labelId);
      if (!hid) pushError(errors, `${hp}.id`, "Hotspot id is required", "REQUIRED");
      if (!labelId) pushError(errors, `${hp}.labelId`, "Hotspot labelId is required", "REQUIRED");
      else if (!labelIds.has(labelId)) {
        pushError(errors, `${hp}.labelId`, `Unknown labelId "${labelId}"`, "REFERENCE");
      }
      normalizedActivities.hotspots.push({
        id: hid,
        labelId,
        region: h.region != null ? safeStr(h.region) : undefined,
      });
    }
  }

  if (Array.isArray(activities.dragDrop)) {
    normalizedActivities.dragDrop = [];
    for (let i = 0; i < activities.dragDrop.length; i++) {
      const d = activities.dragDrop[i];
      const dp = `activities.dragDrop[${i}]`;
      if (!d || typeof d !== "object") {
        pushError(errors, dp, "Drag-drop seed must be an object", "INVALID_TYPE");
        continue;
      }
      const pairId = safeStr(d.pairId);
      const prompt = safeStr(d.prompt);
      const labelId = safeStr(d.labelId);
      if (!pairId) pushError(errors, `${dp}.pairId`, "pairId is required", "REQUIRED");
      if (!prompt) pushError(errors, `${dp}.prompt`, "prompt is required", "REQUIRED");
      if (!labelId) pushError(errors, `${dp}.labelId`, "labelId is required", "REQUIRED");
      else if (!labelIds.has(labelId)) {
        pushError(errors, `${dp}.labelId`, `Unknown labelId "${labelId}"`, "REFERENCE");
      }
      normalizedActivities.dragDrop.push({
        pairId,
        prompt,
        labelId,
        dropZoneId: d.dropZoneId != null ? safeStr(d.dropZoneId) : undefined,
      });
    }
  }

  if (Array.isArray(activities.examQuestions)) {
    normalizedActivities.examQuestions = [];
    for (let i = 0; i < activities.examQuestions.length; i++) {
      const q = activities.examQuestions[i];
      const qp = `activities.examQuestions[${i}]`;
      if (!q || typeof q !== "object") {
        pushError(errors, qp, "Exam question seed must be an object", "INVALID_TYPE");
        continue;
      }
      const qid = safeStr(q.id);
      const qtype = safeStr(q.type);
      const qprompt = safeStr(q.prompt);
      if (!qid) pushError(errors, `${qp}.id`, "id is required", "REQUIRED");
      if (!qtype) pushError(errors, `${qp}.type`, "type is required", "REQUIRED");
      if (!qprompt) pushError(errors, `${qp}.prompt`, "prompt is required", "REQUIRED");
      if (Array.isArray(q.labelIds)) {
        for (const lid of q.labelIds) {
          if (!labelIds.has(safeStr(lid))) {
            pushError(errors, `${qp}.labelIds`, `Unknown labelId "${lid}"`, "REFERENCE");
          }
        }
      }
      normalizedActivities.examQuestions.push({
        id: qid,
        type: qtype,
        prompt: qprompt,
        labelIds: Array.isArray(q.labelIds) ? q.labelIds.map(safeStr) : undefined,
        correctAnswer: q.correctAnswer != null ? safeStr(q.correctAnswer) : undefined,
        options: Array.isArray(q.options) ? q.options.map(safeStr) : undefined,
      });
    }
  }

  const visualStyle =
    spec.visualStyle && typeof spec.visualStyle === "object" ? { ...spec.visualStyle } : undefined;

  const status = safeStr(spec.status) || "draft";
  if (!["draft", "validated"].includes(status)) {
    pushError(errors, "status", "status must be draft or validated", "INVALID_ENUM");
  }

  if (errors.length > 0) {
    return { ok: false, errors, normalized: null };
  }

  /** @type {import("./schema").DiagramSpecification} */
  const normalized = {
    schemaVersion: SCHEMA_VERSION,
    id,
    subject: safeStr(spec.subject),
    examBoard,
    tier,
    topic: safeStr(spec.topic),
    subtopic: spec.subtopic != null ? safeStr(spec.subtopic) : undefined,
    learningGoal: safeStr(spec.learningGoal),
    diagramType,
    interactionTypes: interactionTypes.map(safeStr),
    activityPedagogyType: activityPedagogyType || undefined,
    imageElements: imageElements.length ? imageElements : undefined,
    conceptCards: conceptCards.length ? conceptCards : undefined,
    title: safeStr(spec.title),
    instruction: spec.instruction != null ? safeStr(spec.instruction) : undefined,
    examFocus: examFocus.length ? examFocus : undefined,
    difficulty,
    teacherNotes: spec.teacherNotes != null ? safeStr(spec.teacherNotes) : undefined,
    labels: normalizedLabels,
    layout: normalizedLayout,
    activities: Object.keys(normalizedActivities).length ? normalizedActivities : undefined,
    visualStyle,
    status,
  };

  return { ok: true, errors: [], normalized };
}

module.exports = {
  validateDiagramSpecification,
};
