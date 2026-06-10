/**
 * Required Practical Mode — investigation lesson structure (Save My Exams style).
 * Switches Teacher-First from knowledge delivery to method / variables / results / evaluation.
 */

/** Locked RP baseline — bump only with explicit milestone approval. */
const REQUIRED_PRACTICAL_MODE_VERSION = "V2.2";

/**
 * Canonical ruler-drop orientation (AQA GCSE reaction time).
 * Do NOT use "0 cm at the top" anywhere in RP generation.
 */
const REACTION_TIME_RULER_DROP_ORIENTATION = "0 cm at the bottom aligned with the thumb";

const REACTION_TIME_RULER_DROP_ORIENTATION_FORBIDDEN = /0\s*cm\s+at\s+the\s+top/i;

const { detectRpSpecialistBlock } = require("./requiredPracticalBlockParse");

const REQUIRED_PRACTICAL_TOPIC_KEY_PATTERNS = [
  /\brp-/i,
  /required-practical/i,
  /required_practical/i,
];

const REQUIRED_PRACTICAL_LABEL_PATTERNS = [
  /required\s+practical/i,
  /\brp\s*:/i,
  /\brp\s*-/i,
  /\brp\b/i,
  /\bpractical\b/i,
  /\binvestigation\b/i,
  /\bexperiment\b/i,
  /\bmethod\b/i,
];

/** 19-block Required Practical SS1 shell (GCSE AQA Higher Tier investigation flow). */
const REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS = [
  { key: "objectives", title: "REVISION OBJECTIVES", paste: "Text (concept)", role: "lessonObjectives" },
  { key: "priorKnowledge", title: "PRIOR KNOWLEDGE", paste: "Text (concept)", role: "priorKnowledge" },
  { key: "practicalPurpose", title: "PRACTICAL PURPOSE", paste: "Text (concept)", role: "practicalPurpose" },
  { key: "scientificBackground", title: "SCIENTIFIC BACKGROUND", paste: "Text (concept)", role: "scientificBackground" },
  { key: "hypothesis", title: "HYPOTHESIS / PREDICTION", paste: "Text (concept)", role: "hypothesis" },
  { key: "variables", title: "VARIABLES", paste: "Text (concept)", role: "variables" },
  {
    key: "variablesMatch",
    title: "VARIABLES MATCHING ACTIVITY",
    paste: "Drag and drop match",
    role: "match",
  },
  { key: "equipment", title: "EQUIPMENT", paste: "Text (concept)", role: "equipment", specialist: true },
  { key: "method", title: "METHOD", paste: "Text (concept)", role: "method", specialist: true },
  { key: "diagram", title: "PRACTICAL SETUP DIAGRAM", paste: "Diagram (concept)", role: "diagram" },
  { key: "resultsTable", title: "RESULTS TABLE", paste: "Text (concept)", role: "resultsTable", specialist: true },
  { key: "processingResults", title: "PROCESSING RESULTS", paste: "Text (concept)", role: "processingResults" },
  { key: "analysis", title: "ANALYSIS", paste: "Text (concept)", role: "analysis" },
  { key: "evaluationGrid", title: "EVALUATION GRID", paste: "Text (concept)", role: "evaluationGrid", specialist: true },
  { key: "commonMistake", title: "COMMON MISTAKES", paste: "Common mistake", role: "commonMistake" },
  { key: "examTip", title: "EXAM TECHNIQUE", paste: "Exam tip (concept)", role: "examTechnique" },
  { key: "examPractice", title: "REQUIRED PRACTICAL EXAM PRACTICE", paste: "Text (concept)", role: "examPractice" },
  { key: "summary", title: "SUMMARY", paste: "Text (concept)", role: "synthesis" },
  { key: "keywords", title: "KEY WORDS", paste: "Key words", role: "keywords" },
];

const REQUIRED_PRACTICAL_DASHBOARD_SLOTS = REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.map((slot) => ({
  key: slot.key,
  title: slot.title
    .split(" ")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ")
    .replace(/^Revision objectives$/i, "Revision Objectives")
    .replace(/^Prior knowledge$/i, "Prior Knowledge")
    .replace(/^Key words$/i, "Key Words")
    .replace(/^Exam technique$/i, "Exam Technique")
    .replace(/^Common mistakes$/i, "Common Mistakes")
    .replace(/^Required practical exam practice$/i, "Required Practical Exam Practice")
    .replace(/^Evaluation grid$/i, "Evaluation Grid"),
  type: slot.key === "diagram" ? "diagram" : slot.key === "keywords" ? "keyWords" : "text",
  role: slot.role,
}));

/** V2.1 — mandatory structured specialist blocks whenever RP mode is active. */
const REQUIRED_PRACTICAL_MANDATORY_SPECIALIST_BLOCK_KEYS = [
  "equipment",
  "method",
  "resultsTable",
  "evaluationGrid",
];

/** Teacher-first knowledge slots that RP mode must NOT emit (V2 full replacement). */
const TEACHER_FIRST_FORBIDDEN_SLOT_KEYS = [
  "definition",
  "whyItMatters",
  "coreModel",
  "coreRule",
  "keyExamples",
  "examVocabulary",
  "scenario",
  "coreTeaching",
];

/** Core investigation slots that replace blocks 3–7 of teacher-first opening. */
const REQUIRED_PRACTICAL_CORE_REPLACEMENT_KEYS = [
  "practicalPurpose",
  "scientificBackground",
  "hypothesis",
  "variables",
  "equipment",
  "method",
  "resultsTable",
  "analysis",
  "evaluationGrid",
];

const TEACHER_FIRST_FORBIDDEN_ROLES = new Set([
  "definition",
  "whyitmatters",
  "coremodel",
  "corerule",
  "keyexamples",
  "examvocabulary",
  "hook",
  "scenario",
  "coreteaching",
  "concept",
]);

const TEACHER_FIRST_FORBIDDEN_TITLE_RE = [
  /^definition$/i,
  /why it matters/i,
  /^core model$/i,
  /^key examples$/i,
  /^exam vocabulary$/i,
  /^scenario$/i,
  /^core teaching$/i,
  /^hook$/i,
  /^core rule$/i,
];

const REACTION_TIME_TOPIC_PATTERNS = [/reaction[-\s]?time/i, /rp-reaction-time/i];

const REACTION_TIME_DIAGRAM_IMAGE =
  "/visuals/biology/aqa-gcse/homeostasis-and-response/the-human-nervous-system/required-practical-reaction-time.svg";

const REACTION_TIME_INTERACTIVE_DIAGRAM = {
  type: "interactiveDiagram",
  title: "Practical Setup Diagram",
  role: "diagram",
  intro: "Click each label to identify parts of the ruler-drop test setup.",
  imageUrl: REACTION_TIME_DIAGRAM_IMAGE,
  hotspots: [
    {
      id: "ruler",
      x: 50,
      y: 12,
      label: "Ruler",
      description: `30 cm ruler held vertically above the catching hand; ${REACTION_TIME_RULER_DROP_ORIENTATION}.`,
    },
    {
      id: "release-point",
      x: 50,
      y: 22,
      label: "Release point",
      description: "Where the partner releases the ruler without warning.",
    },
    {
      id: "measurement-scale",
      x: 58,
      y: 45,
      label: "Measurement scale",
      description: `Read the distance (cm) where the ruler was caught. Scale uses ${REACTION_TIME_RULER_DROP_ORIENTATION}.`,
    },
    {
      id: "thumb",
      x: 46,
      y: 78,
      label: "Thumb",
      description: `Part of the catching hand used with the forefinger; level with the 0 cm mark (${REACTION_TIME_RULER_DROP_ORIENTATION}).`,
    },
    {
      id: "forefinger",
      x: 54,
      y: 78,
      label: "Forefinger",
      description: "Used with the thumb to catch the ruler as quickly as possible.",
    },
  ],
};

function buildReactionTimeInteractiveDiagramBlock() {
  return { ...REACTION_TIME_INTERACTIVE_DIAGRAM };
}

function enforceReactionTimeInteractiveDiagram(blocks = [], ctx = {}) {
  if (!isReactionTimePractical(ctx) || !Array.isArray(blocks)) return blocks;
  const preset = buildReactionTimeInteractiveDiagramBlock();
  return blocks.map((block) => {
    const role = String(block?.role || "").toLowerCase();
    const title = String(block?.title || "").toLowerCase();
    if (role === "diagram" || /practical setup diagram/.test(title)) {
      return {
        ...block,
        ...preset,
        title: block.title || preset.title,
      };
    }
    return block;
  });
}

const REACTION_TIME_RP_PROFILE = {
  taxonomyKey: "rp-reaction-time",
  label: "Required Practical: Reaction time",
  practicalPurpose:
    "To investigate how quickly a person can respond to a stimulus using the ruler-drop test — a model of reflex response time.",
  scientificBackground:
    "Reaction time is the interval between detecting a stimulus and producing a response. In the ruler-drop test, the distance the ruler falls before it is caught is used to estimate reaction time. Faster reactions produce a shorter fall distance.",
  hypothesis:
    "The further the ruler falls before it is caught, the longer the reaction time. Repeating the test and calculating a mean improves reliability.",
  variables: {
    independent:
      "Stimulus type or condition being tested (e.g. visual drop of ruler; optional comparison such as distraction or caffeine).",
    dependent:
      "Reaction time — measured using the distance the ruler falls before it is caught (or converted to time using a table or equation).",
    control: [
      "same ruler",
      "same starting position",
      "same participant",
      "same hand",
      "same drop height",
      "same ruler orientation (0 cm at bottom aligned with thumb)",
      "same instructions",
      "same number of repeats",
    ],
  },
  rulerDropOrientation: REACTION_TIME_RULER_DROP_ORIENTATION,
  equipment: [
    "30 cm ruler",
    "Partner",
    "Chair",
    "Table",
    "Results table",
    "Calculator",
  ],
  methodSteps: [
    "Sit comfortably with forearm resting on the table.",
    `Partner holds the 30 cm ruler vertically above the thumb and forefinger, with ${REACTION_TIME_RULER_DROP_ORIENTATION}.`,
    "Partner releases ruler without warning.",
    "Catch ruler as quickly as possible.",
    "Record the distance (cm) where the ruler was caught (read from the scale — 0 cm at the bottom).",
    "Repeat five times.",
    "Calculate mean.",
    "Compare conditions if required.",
  ],
  resultsTableHeaders: ["Trial", "Distance (cm)", "Notes"],
  resultsTableRows: 5,
  processingResults: [
    "Repeat readings to improve reliability.",
    "Calculate the mean distance (or mean reaction time).",
    "Identify anomalies — only ignore a result if you can justify it (e.g. ruler slipped, participant anticipated the drop).",
    "Use evidence from the mean to compare conditions.",
  ],
  analysis: [
    "A smaller distance means a faster reaction time.",
    "Calculate and compare means across conditions.",
    "Link results to the nervous system pathway: stimulus → receptor → coordinator → effector → response.",
  ],
  evaluationGrid: [
    {
      aspect: "Anticipation",
      comment: "Faster reaction times if the participant predicts the drop",
      improvement: "Random release intervals",
    },
    {
      aspect: "Human error",
      comment: "Inconsistent measurements when reading the scale",
      improvement: "Use electronic timer / light gate",
    },
    {
      aspect: "Small sample size",
      comment: "Less reliable conclusions from few repeats",
      improvement: "Increase number of participants or repeats",
    },
  ],
  examVocabulary: [
    "stimulus",
    "receptor",
    "response",
    "reaction time",
    "independent variable",
    "dependent variable",
    "control variable",
    "reliability",
    "accuracy",
    "anomaly",
    "mean",
  ],
  keyWordsTerms: [
    "reaction time",
    "stimulus",
    "receptor",
    "response",
    "independent variable",
    "dependent variable",
    "control variable",
    "reliability",
    "accuracy",
    "anomaly",
    "mean",
    "ruler-drop test",
  ],
};

function normalizeLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s:&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectLabels(input = {}) {
  const labels = [];
  for (const key of ["topic", "subTopic", "title"]) {
    const v = String(input[key] || "").trim();
    if (v) labels.push(v);
  }
  const leaf = String(input.topicKey || "").split(":").pop() || "";
  if (leaf) labels.push(leaf.replace(/-/g, " "));
  return labels;
}

/**
 * True when the lesson should use Required Practical Mode (not standard Teacher-First knowledge).
 * @param {object} [input]
 */
function isRequiredPracticalMode(input = {}) {
  const topicKey = String(input.topicKey || "").trim();
  if (topicKey && REQUIRED_PRACTICAL_TOPIC_KEY_PATTERNS.some((re) => re.test(topicKey))) {
    return true;
  }

  for (const label of collectLabels(input)) {
    const hay = normalizeLabel(label);
    if (!hay) continue;
    if (REQUIRED_PRACTICAL_LABEL_PATTERNS.some((re) => re.test(hay))) {
      return true;
    }
  }

  return false;
}

function isReactionTimePractical(input = {}) {
  const topicKey = String(input.topicKey || "").trim();
  if (topicKey && REACTION_TIME_TOPIC_PATTERNS.some((re) => re.test(topicKey))) {
    return true;
  }
  return collectLabels(input).some((label) =>
    REACTION_TIME_TOPIC_PATTERNS.some((re) => re.test(normalizeLabel(label)))
  );
}

function resolveRequiredPracticalProfile(input = {}) {
  if (isReactionTimePractical(input)) {
    return { ...REACTION_TIME_RP_PROFILE };
  }
  return {
    taxonomyKey: "required-practical-generic",
    label: String(input.subTopic || input.topic || "Required Practical").trim(),
    practicalPurpose: "To carry out a fair-test investigation and analyse GCSE-standard results.",
    scientificBackground: "Brief relevant theory that explains what is being measured and why the method works.",
    hypothesis: "A testable prediction linking the independent and dependent variables.",
    variables: {
      independent: "The variable you change deliberately.",
      dependent: "The variable you measure.",
      control: ["List control variables that must stay the same for a fair test."],
    },
    equipment: ["List all apparatus needed for the method."],
    methodSteps: ["Numbered steps for a safe, repeatable method."],
    processingResults: ["Repeats", "Mean", "Anomalies"],
    analysis: ["What the pattern in the results shows."],
    evaluationGrid: [
      { aspect: "Reliability", comment: "How repeatable are the results?", improvement: "Use more repeats and calculate a mean." },
      { aspect: "Accuracy", comment: "How close are measurements to the true value?", improvement: "Use more precise measuring equipment." },
      { aspect: "Control variables", comment: "Were all controls kept the same?", improvement: "List controls and keep them constant." },
      { aspect: "Improvements", comment: "What limitation affects the conclusion?", improvement: "Suggest one valid improvement to the method." },
    ],
    examVocabulary: ["independent variable", "dependent variable", "control variable", "reliability", "accuracy"],
    keyWordsTerms: ["independent variable", "dependent variable", "control variable", "reliability", "accuracy"],
  };
}

function formatVariablesBlock(profile) {
  const v = profile.variables || {};
  const controls = Array.isArray(v.control) ? v.control : [];
  return [
    "**Independent variable:**",
    v.independent || "The variable you change.",
    "",
    "**Dependent variable:**",
    v.dependent || "The variable you measure.",
    "",
    "**Control variables:**",
    ...controls.map((c) => `- ${c}`),
  ].join("\n");
}

function formatBulletBlock(items = []) {
  return items.map((line) => `- ${line}`).join("\n");
}

function formatNumberedBlock(items = []) {
  return items.map((line, i) => `${i + 1}. ${line}`).join("\n");
}

function normalizeReactionTimeRulerOrientation(text = "") {
  return String(text || "").replace(
    REACTION_TIME_RULER_DROP_ORIENTATION_FORBIDDEN,
    REACTION_TIME_RULER_DROP_ORIENTATION
  );
}

function buildReactionTimeRulerDropOrientationLines() {
  return [
    "RULER-DROP SETUP (reaction time — mandatory):",
    `- Hold the ruler vertically with ${REACTION_TIME_RULER_DROP_ORIENTATION}.`,
    '- FORBIDDEN: "0 cm at the top" or any inverted scale orientation.',
  ];
}

function finalizeReactionTimePracticalText(text = "", plan = {}) {
  if (
    !isReactionTimePractical({
      topicKey: plan.topicKey,
      topic: plan.topicLabel,
      subTopic: plan.topicLabel,
    })
  ) {
    return text;
  }
  return normalizeReactionTimeRulerOrientation(text);
}

function formatEquipmentSpecialist(items = []) {
  const list = Array.isArray(items) ? items : [];
  return ["**Equipment list (mandatory):**", ...list.map((item) => `- ${item}`)].join("\n");
}

function formatMethodSpecialist(items = []) {
  const list = Array.isArray(items) ? items : [];
  return ["**Method (numbered steps — mandatory):**", ...list.map((step, i) => `${i + 1}. ${step}`)].join("\n");
}

function parseMarkdownTableRow(row = "") {
  const parts = String(row).split("|").map((c) => c.trim());
  if (parts.length && parts[0] === "") parts.shift();
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function formatVariablesMatchSpecialist(profile = {}) {
  const v = profile.variables || {};
  const iv = v.independent || "Independent variable";
  const dv = v.dependent || "Dependent variable";
  const control = Array.isArray(v.control) && v.control.length ? v.control[0] : "Control variable";
  const items = ["Independent variable", "Dependent variable", "Control variable"];
  const zones = [
    "What you change deliberately → ______",
    "What you measure → ______",
    "What must stay the same for a fair test → ______",
  ];
  const answers = [iv, dv, control];
  return [
    "Instruction:",
    "Match each variable type to its role in this investigation.",
    "",
    "Items to drag:",
    ...items.map((item) => `- ${item}`),
    "",
    "Drop zones:",
    ...zones.map((zone) => `- ${zone}`),
    "",
    "Answer key:",
    ...items.map((item, i) => `- ${item} → ${answers[i]}`),
  ].join("\n");
}

function formatResultsTableSpecialist(profile = {}, topicLabel = "investigation") {
  const headers = profile.resultsTableHeaders || ["Trial", "Distance (cm)", "Notes"];
  const headerRow = `| ${headers.join(" | ")} |`;
  const sepRow = `| ${headers.map(() => "---").join(" | ")} |`;
  const rowCount = Number(profile.resultsTableRows) || 5;
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const cells = headers.map((_, j) => (j === 0 ? String(i + 1) : ""));
    return `| ${cells.join(" | ")} |`;
  });
  const meanCells = headers.map((h, j) => (j === 0 ? "Mean" : ""));
  return [
    `**Results table for ${topicLabel} (mandatory):**`,
    headerRow,
    sepRow,
    ...rows,
    `| ${meanCells.join(" | ")} |`,
  ].join("\n");
}

function formatEvaluationGrid(profile = {}) {
  const rows = Array.isArray(profile.evaluationGrid) ? profile.evaluationGrid : [];
  const lines = [
    "**Evaluation grid (mandatory):**",
    "| Limitation | Effect on Results | Improvement |",
    "| --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.aspect || row.limitation || "Limitation"} | ${row.comment || row.effect || ""} | ${row.improvement || ""} |`
    ),
  ];
  return lines.join("\n");
}

function buildRequiredPracticalSpecialistBlocksSection() {
  return [
    "--------------------------------",
    "REQUIRED PRACTICAL V2.2 — MANDATORY SPECIALIST BLOCKS (VISIBLE SECTIONS)",
    "--------------------------------",
    "",
    "When Required Practical Mode is active, these four blocks are NON-OPTIONAL standalone lesson sections:",
    "",
    "1. EQUIPMENT — visible bulleted apparatus list (minimum 3 items). Title: \"Equipment\". Must appear BEFORE Method.",
    "2. METHOD — visible numbered procedure (minimum 5 steps). Title: \"Method\". Separate from Step-by-Step teaching.",
    "3. RESULTS TABLE — visible markdown/HTML table with Trial rows AND a Mean row. Title: \"Results Table\".",
    "4. EVALUATION GRID — visible table: Limitation | Effect on Results | Improvement. Title: \"Evaluation Grid\".",
    "",
    "Do NOT merge Equipment or Method into Core Teaching or Core Learning blocks.",
    "Do NOT hide tables inside prose paragraphs — use the dedicated Results Table and Evaluation Grid blocks.",
  ].join("\n");
}

function countBulletItems(text = "") {
  const hay = String(text || "");
  return (hay.match(/^[\s]*[-*•]\s+/gm) || []).length + (hay.match(/<li\b/gi) || []).length;
}

function countNumberedSteps(text = "") {
  const hay = String(text || "");
  return (hay.match(/^\s*\d+[\.)]\s+/gm) || []).length + (hay.match(/<li\b/gi) || []).length;
}

function hasMarkdownTable(text = "", minRows = 2) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));
  return lines.length >= minRows + 1;
}

function hasEvaluationGridRows(text = "") {
  const hay = String(text || "").toLowerCase();
  return (
    hasMarkdownTable(text, 2) &&
    (/limitation/i.test(hay) || /anticipation/i.test(hay) || /reliability/i.test(hay)) &&
    (/improvement/i.test(hay) || /effect on results/i.test(hay))
  );
}

function dashboardTitleForSpecialistSlot(slotKey) {
  return REQUIRED_PRACTICAL_DASHBOARD_SLOTS.find((d) => d.key === slotKey)?.title || slotKey;
}

function isSpecialistBlockContentValid(content = "", slotKey = "") {
  const text = String(content || "").trim();
  if (!text) return false;
  switch (slotKey) {
    case "equipment":
      return countBulletItems(text) >= 3 || (text.includes(",") && text.split(",").length >= 3);
    case "method":
      return countNumberedSteps(text) >= 4;
    case "resultsTable":
      return hasMarkdownTable(text, 3) && /mean/i.test(text);
    case "evaluationGrid":
      return hasEvaluationGridRows(text);
    default:
      return true;
  }
}

function ensureSpecialistBlockContent(block = {}, slotKey = "", plan = {}) {
  if (!REQUIRED_PRACTICAL_MANDATORY_SPECIALIST_BLOCK_KEYS.includes(slotKey)) {
    return block;
  }
  const slotDef = REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.find((s) => s.key === slotKey);
  const contentValid = isSpecialistBlockContentValid(block.content, slotKey);
  return {
    ...block,
    type: block.type || "text",
    title: dashboardTitleForSpecialistSlot(slotKey),
    role: slotDef?.role || block.role,
    content: contentValid
      ? finalizeReactionTimePracticalText(block.content, plan)
      : slotContentForPlan(slotKey, plan),
  };
}

function resolveRequiredPracticalPlan(plan = {}) {
  if (plan?.mode === "requiredPractical") return plan;
  if (!plan?.topicKey && !plan?.topicLabel && !plan?.subTopic && !plan?.topic) return null;
  return buildRequiredPracticalOpeningPlan(plan);
}

function findSpecialistBlockIndex(blocks = [], slotKey = "") {
  const slot = REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.find((s) => s.key === slotKey);
  if (!slot) return -1;
  const dashboardTitle = dashboardTitleForSpecialistSlot(slotKey);
  return blocks.findIndex((b) => {
    if (detectRpSpecialistBlock(b) === slotKey) return true;
    const title = String(b?.title || "").toLowerCase().trim();
    const role = String(b?.role || "").toLowerCase();
    return (
      role === slot.role.toLowerCase() ||
      title === slot.title.toLowerCase() ||
      title === String(dashboardTitle).toLowerCase()
    );
  });
}

function buildSpecialistBlock(slotKey = "", plan = {}) {
  const slotDef = REQUIRED_PRACTICAL_DASHBOARD_SLOTS.find((d) => d.key === slotKey);
  return ensureSpecialistBlockContent(
    { type: slotDef?.type || "text" },
    slotKey,
    plan
  );
}

function isPostSpecialistAnchorBlock(block = {}) {
  const title = String(block?.title || "").toLowerCase().trim();
  const role = String(block?.role || "").toLowerCase();
  if (role === "examtechnique" || role === "exampractice" || role === "synthesis") return true;
  if (role === "workedexample") return true;
  return /exam technique|exam practice|worked example|^summary\b/.test(title);
}

function findInsertIndexForSpecialistSlot(blocks = [], slotKey = "") {
  const order = REQUIRED_PRACTICAL_MANDATORY_SPECIALIST_BLOCK_KEYS;
  const myOrder = order.indexOf(slotKey);

  for (let i = myOrder - 1; i >= 0; i -= 1) {
    const priorIdx = findSpecialistBlockIndex(blocks, order[i]);
    if (priorIdx >= 0) return priorIdx + 1;
  }

  for (let i = 0; i < blocks.length; i += 1) {
    if (isPostSpecialistAnchorBlock(blocks[i])) return i;
  }

  return blocks.length;
}

function moveMisplacedSpecialistBlocks(blocks = [], plan = {}) {
  let anchorIdx = blocks.length;
  for (let i = 0; i < blocks.length; i += 1) {
    if (isPostSpecialistAnchorBlock(blocks[i])) {
      anchorIdx = i;
      break;
    }
  }

  const presentBefore = new Set();
  for (let i = 0; i < anchorIdx; i += 1) {
    const kind = detectRpSpecialistBlock(blocks[i]);
    if (kind) presentBefore.add(kind);
  }

  const kept = [];
  const toInsert = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const kind = detectRpSpecialistBlock(block);
    if (kind && i >= anchorIdx) {
      if (presentBefore.has(kind)) continue;
      presentBefore.add(kind);
      toInsert.push(ensureSpecialistBlockContent(block, kind, plan));
      continue;
    }
    kept.push(block);
  }

  if (!toInsert.length) return blocks;

  let insertAt = kept.length;
  for (let i = 0; i < kept.length; i += 1) {
    if (isPostSpecialistAnchorBlock(kept[i])) {
      insertAt = i;
      break;
    }
  }

  const ordered = REQUIRED_PRACTICAL_MANDATORY_SPECIALIST_BLOCK_KEYS.map((key) =>
    toInsert.find((b) => detectRpSpecialistBlock(b) === key)
  ).filter(Boolean);

  return [...kept.slice(0, insertAt), ...ordered, ...kept.slice(insertAt)];
}

function enforceMandatorySpecialistBlocks(blocks = [], plan = {}) {
  if (!Array.isArray(blocks)) return blocks;
  const resolvedPlan = resolveRequiredPracticalPlan(plan);
  if (!resolvedPlan) return blocks;

  const out = [...blocks];
  for (const slotKey of REQUIRED_PRACTICAL_MANDATORY_SPECIALIST_BLOCK_KEYS) {
    const idx = findSpecialistBlockIndex(out, slotKey);
    if (idx >= 0) {
      out[idx] = ensureSpecialistBlockContent(out[idx], slotKey, resolvedPlan);
    } else {
      const insertAt = findInsertIndexForSpecialistSlot(out, slotKey);
      out.splice(insertAt, 0, buildSpecialistBlock(slotKey, resolvedPlan));
    }
  }

  return moveMisplacedSpecialistBlocks(out, resolvedPlan);
}

function stripDuplicateSpecialistBlocksFromRemainder(remainder = []) {
  return (Array.isArray(remainder) ? remainder : []).filter((b) => !detectRpSpecialistBlock(b));
}

/**
 * Content hints for dashboard opening enforcement / prompt appendix.
 */
function buildRequiredPracticalOpeningPlan(input = {}) {
  const profile = resolveRequiredPracticalProfile(input);
  const topicLabel = String(input.subTopic || input.topic || profile.label).trim();
  return {
    mode: "requiredPractical",
    enabled: true,
    topicLabel,
    topicKey: input.topicKey || "",
    profile,
    practicalPurpose: profile.practicalPurpose,
    scientificBackground: profile.scientificBackground,
    hypothesis: profile.hypothesis,
    variablesText: formatVariablesBlock(profile),
    variablesMatchText: formatVariablesMatchSpecialist(profile),
    equipmentText: formatEquipmentSpecialist(profile.equipment),
    methodText: formatMethodSpecialist(profile.methodSteps),
    processingText: formatBulletBlock(profile.processingResults),
    analysisText: formatBulletBlock(profile.analysis),
    resultsTableText: formatResultsTableSpecialist(profile, topicLabel),
    evaluationGridText: formatEvaluationGrid(profile),
    examVocabulary: profile.examVocabulary || [],
    keyWordsTerms: profile.keyWordsTerms || [],
  };
}

function slotContentForPlan(slotKey, plan) {
  const p = plan.profile;
  switch (slotKey) {
    case "objectives":
      return `By the end of this lesson you will be able to:\n- Describe the aim of the ${plan.topicLabel} investigation.\n- Identify variables and explain a safe method.\n- Process results (mean, anomalies) and evaluate reliability and accuracy.`;
    case "priorKnowledge":
      return "You should already know:\n- Stimulus → receptor → coordinator → effector → response.\n- How to identify independent, dependent and control variables.\n- How to calculate a mean and spot an anomalous result.";
    case "practicalPurpose":
      return p.practicalPurpose;
    case "scientificBackground":
      return p.scientificBackground;
    case "hypothesis":
      return p.hypothesis;
    case "variables":
      return plan.variablesText;
    case "variablesMatch":
      return plan.variablesMatchText;
    case "equipment":
      return plan.equipmentText;
    case "method":
      return finalizeReactionTimePracticalText(plan.methodText, plan);
    case "resultsTable":
      return plan.resultsTableText;
    case "processingResults":
      return plan.processingText;
    case "analysis":
      return plan.analysisText;
    case "evaluationGrid":
      return plan.evaluationGridText;
    case "commonMistake":
      return "- Confusing reliability with accuracy.\n- Ignoring anomalies without a reason.\n- Changing more than one variable at a time.";
    case "examTip":
      return "In 6-mark practical questions: state variables → describe method → process data (mean/anomaly) → evaluate reliability and improvements.";
    case "examPractice":
      return "Q1 (2 marks): State the independent and dependent variables in this investigation.\nQ2 (4 marks): Describe a method to investigate reaction time using a ruler.\nQ3 (6 marks): A student caught the ruler at 18 cm on average. Explain what this shows and evaluate the reliability of the method.";
    case "summary":
      return `This required practical on ${plan.topicLabel} follows: purpose → hypothesis → variables → method → results → processing → analysis → evaluation.`;
    case "keywords":
      return (p.keyWordsTerms || []).map((t) => `**${t}** — GCSE key term for this practical.`).join("\n");
    case "diagram":
      return finalizeReactionTimePracticalText(
        `Diagram showing the ruler-drop test setup: Person B holds a vertical 30 cm ruler above Person A's thumb and forefinger; ${REACTION_TIME_RULER_DROP_ORIENTATION}.`,
        plan
      );
    default:
      return "";
  }
}

function buildRequiredPracticalReplacementDirective() {
  return [
    "REQUIRED PRACTICAL V2 — FULL REPLACEMENT (NOT ADD-ON):",
    "Do NOT use teacher-first knowledge opening blocks. These are FORBIDDEN:",
    "- Definition",
    "- Why it matters",
    "- Core model / Core rule",
    "- Key examples",
    "- Exam vocabulary (as a separate theory block)",
    "- Scenario / Hook story",
    "- Core Teaching theory chunks",
    "",
    "REPLACE them entirely with investigation blocks:",
    "- Practical Purpose (replaces Definition + Why it matters)",
    "- Scientific Background (replaces Core model)",
    "- Hypothesis / Prediction",
    "- Variables (IV, DV, control variables)",
    "- Equipment",
    "- Method (numbered steps)",
    "- Results Table",
    "- Processing Results (repeats, mean, anomalies)",
    "- Analysis",
    "- Evaluation Grid (reliability, accuracy, control variables, improvements — table format)",
    "",
    "This is a practical investigation lesson — not a theory lesson with a method bolted on.",
  ].join("\n");
}

function isForbiddenTeacherFirstBlock(block = {}) {
  const role = String(block?.role || "").toLowerCase();
  const title = String(block?.title || "").toLowerCase().trim();
  if (TEACHER_FIRST_FORBIDDEN_ROLES.has(role)) return true;
  return TEACHER_FIRST_FORBIDDEN_TITLE_RE.some((re) => re.test(title));
}

function stripForbiddenTeacherFirstBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).filter((b) => !isForbiddenTeacherFirstBlock(b));
}

function buildRequiredPracticalFirstBlocksTemplateSection(ctx = {}) {
  const topic = ctx.subTopic || ctx.topic || "this required practical";
  const plan = buildRequiredPracticalOpeningPlan(ctx);
  const lines = [
    "--------------------------------",
    "BLOCK OUTPUT FORMAT (REQUIRED PRACTICAL — FIRST BLOCKS TEMPLATE)",
    "--------------------------------",
    "",
    buildRequiredPracticalReplacementDirective(),
    "",
    "PAGE 1",
    "",
    "1 — REVISION OBJECTIVES",
    "Paste into: Text (concept)",
    "",
    "<ul>",
    `<li><strong>👉</strong> State the <strong>aim</strong> of the <strong>${topic}</strong> investigation.</li>`,
    "<li><strong>👉</strong> Identify <strong>independent, dependent and control variables</strong>.</li>",
    "<li><strong>👉</strong> Describe a <strong>safe, repeatable method</strong> and process results (mean, anomalies).</li>",
    "<li><strong>👉</strong> <strong>Analyse</strong> and <strong>evaluate</strong> reliability and accuracy.</li>",
    "</ul>",
    "",
    "2 — PRIOR KNOWLEDGE",
    "Paste into: Text (concept)",
    "",
    "<h2><strong>Prior knowledge</strong></h2>",
    "<p>Before we start, you should already know:</p>",
    "<ul>",
    "<li>How to identify independent, dependent and control variables.</li>",
    "<li>How to calculate a mean and justify ignoring an anomaly.</li>",
    "<li>Basic relevant theory for what is being measured.</li>",
    "</ul>",
    "",
    "3 — PRACTICAL PURPOSE",
    "Paste into: Text (concept)",
    "",
    `<p>👉 <strong>${plan.practicalPurpose}</strong></p>`,
    "",
    "4 — SCIENTIFIC BACKGROUND",
    "Paste into: Text (concept)",
    "",
    `<p>👉 <strong>${plan.scientificBackground}</strong></p>`,
    "",
    "5 — HYPOTHESIS / PREDICTION",
    "Paste into: Text (concept)",
    "",
    `<p>👉 <strong>${plan.hypothesis}</strong></p>`,
    "",
    "6 — VARIABLES",
    "Paste into: Text (concept)",
    "",
    plan.variablesText
      .split("\n")
      .map((line) => (line ? `<p>${line}</p>` : ""))
      .join("\n"),
    "",
    "7 — VARIABLES MATCHING ACTIVITY",
    "Paste into: Drag and drop match",
    "",
    plan.variablesMatchText,
    "",
    "8 — EQUIPMENT",
    "Paste into: Text (concept)",
    "",
    "<ul>",
    ...plan.profile.equipment.map((item) => `<li>${item}</li>`),
    "</ul>",
    "",
    "9 — METHOD",
    "Paste into: Text (concept)",
    "",
    "<ol>",
    ...plan.profile.methodSteps.map((step) => `<li>${step}</li>`),
    "</ol>",
    "",
    "10 — PRACTICAL SETUP DIAGRAM",
    "Paste into: Diagram (concept)",
    "",
    "Placement: [describe setup — e.g. ruler held above hand]",
    "",
    `Then continue with blocks 11–${REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.length} exactly as listed in SS1 BLOCK ORDER.`,
    "",
    buildRequiredPracticalSpecialistBlocksSection(),
    "",
    "Do NOT insert Definition, Scenario, Core model, Key examples, or Core Teaching anywhere in this lesson.",
    'Do NOT use the word "BLOCK".',
  ];
  return lines.join("\n");
}

function buildRequiredPracticalAntiDuplicationSection() {
  return `--------------------------------
SS1 OUTPUT RULE (REQUIRED PRACTICAL — ANTI-DUPLICATION)
--------------------------------

Output ONLY ONE lesson in numbered SS1 block format.

FORBIDDEN in any Required Practical lesson:
- Definition, Why it matters, Core model, Key examples, Exam vocabulary, Scenario, Core Teaching
- A theory overview followed by a duplicate practical section
- Homeostasis or nervous system essays unrelated to the investigation method

All practical content MUST appear ONLY inside the numbered investigation blocks (Purpose → Evaluation).
Do NOT duplicate teaching content in the preamble and again in numbered blocks.`;
}

function buildRequiredPracticalDashboardLessonContract(ctx = {}) {
  const topic = ctx.subTopic || ctx.topic || "this required practical";
  return `
## LETSREVISE LESSON CONTRACT (MANDATORY — REQUIRED PRACTICAL V2)

You are generating a **Required Practical investigation lesson** for **${topic}** (GCSE AQA Higher Tier).
Follow the **EXECUTION PERSONA — CONVERSATIONAL TUTOR** rules in the teaching/style section below.

${buildRequiredPracticalReplacementDirective()}

Follow this exact lesson structure:

1. Open with Revision Objectives and Prior Knowledge (blocks 1–2).
2. Blocks 3–13 MUST be investigation teaching — NOT theory opening:
   Practical Purpose → Scientific Background → Hypothesis → Variables → Equipment → Method → Setup Diagram → Results Table → Processing Results → Analysis → Evaluation Grid.
3. Add Common Mistakes (practical errors, not theory misconceptions).
4. Add Exam Technique for 4–6 mark practical questions.
5. Add Required Practical Exam Practice (variables, method, data processing, evaluation).
6. End with Summary and Key Words (practical vocabulary only).

FORBIDDEN block titles/roles: Definition, Why it matters, Core model, Key examples, Exam vocabulary, Scenario, Hook, Core Teaching.

Do NOT generate a homeostasis or nervous system theory lesson. Teach the investigation method like Save My Exams.
${buildRequiredPracticalDashboardPromptSection(ctx)}
`;
}

function buildRequiredPracticalSs1BlockOrderSection(ctx = {}) {
  const topic = ctx.subTopic || ctx.topic || "this required practical";
  const plan = buildRequiredPracticalOpeningPlan(ctx);
  const lines = [
    "--------------------------------",
    "REQUIRED PRACTICAL MODE — SS1 BLOCK ORDER (NON-NEGOTIABLE — PAGE 1)",
    "--------------------------------",
    "",
    buildRequiredPracticalReplacementDirective(),
    "",
    buildRequiredPracticalSpecialistBlocksSection(),
    "",
    `This is a **Required Practical** investigation lesson for **${topic}** (GCSE AQA Higher Tier).`,
    "Do NOT generate a general theory-only nervous system or homeostasis lesson.",
    "Follow Save My Exams / investigation structure: method, variables, equipment, results, analysis, evaluation.",
    "",
    `Output ONE page with blocks in EXACTLY this order (${REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.length} blocks):`,
    "",
  ];

  REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.forEach((slot, i) => {
    lines.push(`${i + 1} — ${slot.title}`);
    lines.push(`Paste into: ${slot.paste}`);
    const hint = slotContentForPlan(slot.key, plan);
    if (hint && slot.key !== "diagram") {
      lines.push(`Content must cover: ${hint.split("\n")[0].slice(0, 120)}…`);
    }
    lines.push("");
  });

  lines.push(
    buildRequiredPracticalSpecialistBlocksSection(),
    "",
    "VARIABLES block must include: Independent variable, Dependent variable, Control variables (bulleted).",
    "METHOD must be numbered steps. RESULTS TABLE must be a table with trial rows. EVALUATION GRID must be a table with Reliability, Accuracy, and Improvements.",
    "Do NOT skip Required Practical Exam Practice before Summary and Key Words."
  );

  if (isReactionTimePractical(ctx)) {
    lines.push("", ...buildReactionTimeRulerDropOrientationLines());
  }

  return lines.join("\n");
}

function buildRequiredPracticalDashboardPromptSection(ctx = {}) {
  const topic = ctx.subTopic || ctx.topic || "this required practical";
  const plan = buildRequiredPracticalOpeningPlan(ctx);
  const lines = [
    "",
    `## REQUIRED PRACTICAL MODE ${REQUIRED_PRACTICAL_MODE_VERSION} (MANDATORY — REPLACES TEACHER-FIRST KNOWLEDGE OPENING)`,
    "",
    buildRequiredPracticalReplacementDirective(),
    "",
    buildRequiredPracticalSpecialistBlocksSection(),
    "",
    `Generate an **investigation lesson** for **${topic}** — NOT a general ${topic.includes("reaction") ? "homeostasis" : "theory"} overview.`,
    "Structure like Save My Exams required practicals: purpose, background, hypothesis, variables, equipment, method, diagram, results, processing, analysis, evaluation.",
    "",
    "pages[0].blocks MUST follow this block order and titles (NO Definition / Scenario / Core model blocks):",
    "",
  ];

  REQUIRED_PRACTICAL_DASHBOARD_SLOTS.forEach((slot, i) => {
    lines.push(
      `${i + 1}. type "${slot.type}", title "${slot.title}", role "${slot.role}"`
    );
  });

  lines.push(
    "",
    "REACTION TIME RULER-DROP (when topic is reaction time):",
    ...buildReactionTimeRulerDropOrientationLines(),
    `- Equipment: ${plan.profile.equipment.join("; ")}`,
    `- Method: ${plan.profile.methodSteps.length} numbered steps including drop, catch, record distance, repeats, mean.`,
    `- Analysis: smaller distance = faster reaction time; calculate mean; justify anomalies.`,
    `- Evaluation grid: Reliability, Accuracy, Control variables, Validity with improvements.`,
    "",
    "MANDATORY SPECIALIST BLOCKS (V2.1): Equipment list, numbered Method, Results Table, Evaluation Grid — all four required.",
    "",
    "Use GCSE AQA Higher Tier command words. Keep Teacher-First clarity: short blocks, explicit headings, no long story opening."
  );

  return lines.join("\n");
}

function formatRequiredPracticalAppendix(input = {}) {
  if (!isRequiredPracticalMode(input)) return "";

  const plan = buildRequiredPracticalOpeningPlan(input);
  const lines = [
    `--- REQUIRED PRACTICAL MODE ${REQUIRED_PRACTICAL_MODE_VERSION} (Teacher Brain) ---`,
    "",
    `Topic: ${plan.topicLabel}`,
    "Mode: investigation / method / variables / results / evaluation — NOT general unit theory.",
    "",
    buildRequiredPracticalReplacementDirective(),
    "",
    "MANDATORY BLOCK SEQUENCE:",
    ...REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.map((s, i) => `${i + 1}. ${s.title}`),
    "",
    "PRACTICAL PURPOSE:",
    plan.practicalPurpose,
    "",
    "SCIENTIFIC BACKGROUND:",
    plan.scientificBackground,
    "",
    "HYPOTHESIS:",
    plan.hypothesis,
    "",
    "VARIABLES:",
    plan.variablesText,
    "",
    "EQUIPMENT:",
    plan.equipmentText,
    "",
    "METHOD:",
    plan.methodText,
    "",
    ...(isReactionTimePractical(input) ? [...buildReactionTimeRulerDropOrientationLines(), ""] : []),
    "PROCESSING RESULTS:",
    plan.processingText,
    "",
    "ANALYSIS:",
    plan.analysisText,
    "",
    "EVALUATION GRID:",
    plan.evaluationGridText,
    "",
    "RESULTS TABLE:",
    plan.resultsTableText,
    "",
    "EXAM VOCABULARY:",
    plan.examVocabulary.join(", "),
    "",
    "--- END REQUIRED PRACTICAL MODE ---",
  ];

  return lines.join("\n");
}

function rpSlotBodyHtml(slotKey, plan) {
  const raw = slotContentForPlan(slotKey, plan);
  if (!raw) return "<p><strong>👉</strong> Add practical content here.</p>";

  if (slotKey === "resultsTable" || slotKey === "evaluationGrid") {
    const tableLines = raw.split("\n").filter((l) => l.trim().startsWith("|"));
    if (tableLines.length >= 2) {
      const headerCells = parseMarkdownTableRow(tableLines[0]);
      const bodyRows = tableLines.slice(2);
      const thead = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
      const tbody = bodyRows
        .map((row) => {
          const cells = parseMarkdownTableRow(row);
          while (cells.length < headerCells.length) cells.push("");
          return `<tr>${cells
            .slice(0, headerCells.length)
            .map((c) => `<td>${c || "&nbsp;"}</td>`)
            .join("")}</tr>`;
        })
        .join("");
      const intro = raw
        .split("\n")
        .filter((l) => l.trim() && !l.trim().startsWith("|"))
        .map((l) => `<p><strong>👉</strong> ${l.replace(/^\*\*|\*\*$/g, "")}</p>`)
        .join("\n");
      return `${intro}<table>${thead}<tbody>${tbody}</tbody></table>`;
    }
  }

  const lines = raw.split("\n").filter((l) => l.trim());
  const parts = [];
  let inList = false;
  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!inList) {
        parts.push("<ul>");
        inList = true;
      }
      parts.push(`<li>${line.slice(2)}</li>`);
      continue;
    }
    if (inList) {
      parts.push("</ul>");
      inList = false;
    }
    if (/^\d+\.\s/.test(line)) {
      parts.push(`<p><strong>👉</strong> ${line}</p>`);
    } else if (line.startsWith("|")) {
      parts.push(`<p>${line}</p>`);
    } else {
      parts.push(`<p><strong>👉</strong> ${line}</p>`);
    }
  }
  if (inList) parts.push("</ul>");
  return parts.join("\n");
}

module.exports = {
  REQUIRED_PRACTICAL_MODE_VERSION,
  REACTION_TIME_RULER_DROP_ORIENTATION,
  REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS,
  REQUIRED_PRACTICAL_DASHBOARD_SLOTS,
  REQUIRED_PRACTICAL_MANDATORY_SPECIALIST_BLOCK_KEYS,
  TEACHER_FIRST_FORBIDDEN_SLOT_KEYS,
  REQUIRED_PRACTICAL_CORE_REPLACEMENT_KEYS,
  REACTION_TIME_RP_PROFILE,
  isRequiredPracticalMode,
  isReactionTimePractical,
  isForbiddenTeacherFirstBlock,
  stripForbiddenTeacherFirstBlocks,
  stripDuplicateSpecialistBlocksFromRemainder,
  isSpecialistBlockContentValid,
  ensureSpecialistBlockContent,
  enforceMandatorySpecialistBlocks,
  findSpecialistBlockIndex,
  resolveRequiredPracticalProfile,
  buildRequiredPracticalOpeningPlan,
  slotContentForPlan,
  rpSlotBodyHtml,
  buildRequiredPracticalReplacementDirective,
  buildRequiredPracticalSpecialistBlocksSection,
  buildRequiredPracticalFirstBlocksTemplateSection,
  buildRequiredPracticalAntiDuplicationSection,
  buildRequiredPracticalDashboardLessonContract,
  buildRequiredPracticalSs1BlockOrderSection,
  buildRequiredPracticalDashboardPromptSection,
  formatRequiredPracticalAppendix,
  formatEquipmentSpecialist,
  formatMethodSpecialist,
  formatResultsTableSpecialist,
  normalizeReactionTimeRulerOrientation,
  buildReactionTimeRulerDropOrientationLines,
  buildReactionTimeInteractiveDiagramBlock,
  enforceReactionTimeInteractiveDiagram,
  REACTION_TIME_INTERACTIVE_DIAGRAM,
  formatEvaluationGrid,
};
