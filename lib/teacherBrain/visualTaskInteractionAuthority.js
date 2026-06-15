/**
 * Phase 3H.1.8b.4d — Visual Task Interaction Authority (VTIA) telemetry.
 *
 * Report-only diagnostics. Detects V1 visual-task intents on non-visual blocks.
 * Flag: TEACHER_BRAIN_VTIA=0 (telemetry enabled). Unset = fully disabled.
 *
 * Does not mutate lessons, reroute activities, or change generation.
 */

const {
  flattenPagesToBlocks,
  normalizeText,
  blockHaystack,
  classifyBlockToArchitectureSlot,
} = require("../lessonBlockAnalysis");
const { isRequiredPracticalMode } = require("./requiredPracticalMode");

const TAXONOMY_VERSION = "V1";

const V1_INTENTS = ["MATCH_LABELS_TO_IMAGE", "LABEL_PATHWAY", "LABEL_DIAGRAM"];

const SOLVABLE_VISUAL_TYPES = new Set([
  "dragdropmatch",
  "interactivediagram",
  "hotspot",
  "labeldiagram",
]);

const TEACHER_FIRST_KNOWLEDGE_SLOTS = [
  "definition",
  "whyItMatters",
  "coreModel",
  "keyExamples",
  "examVocabulary",
];

const BIOLOGY_TOPIC_BOOST =
  /\b(nervous|neurone|neuron|eye|reflex|homeostasis|photosynthesis|enzyme|rp-|reaction time)\b/i;

const MATCH_LABELS_PATTERNS = [
  /\bplace (the )?labels\b/i,
  /\bmatch labels to (the )?(image|diagram|picture)\b/i,
  /\bdrag (each )?labels? onto\b/i,
  /\bdrop (each )?labels? on\b/i,
];

const LABEL_PATHWAY_PATTERNS = [
  /\blabel\b.*\b(pathway|reflex arc)\b/i,
  /\blabel\b.*\bstimulus\b.*\b(response|effector)\b/i,
];

const LABEL_DIAGRAM_PATTERNS = [
  /\blabel the (diagram|parts of|structure|main parts of)\b/i,
  /\blabel the (eye|neurone|neuron|motor neurone|sensory neurone|leaf|heart)\b/i,
  /\blabel\b.*\bparts of (the )?(eye|neurone|neuron)\b/i,
];

const EXPLAIN_PROSE_PATTERN =
  /\b(explain|link|describe|outline|state)\b.*\b(pathway|results)\b/i;

const DESCRIPTIVE_EXCLUDES = [
  /\blabelled diagram\b/i,
  /\bpre[\s-]?labelled\b/i,
  /\balready labelled\b/i,
];

const GRAPH_AXIS_EXCLUDE = /\blabel (your )?(axes|axis|scale)\b/i;

function isVtiaTelemetryEnabled() {
  return String(process.env.TEACHER_BRAIN_VTIA ?? "").trim() === "0";
}

function isVtiaLogEnabled() {
  return (
    isVtiaTelemetryEnabled() &&
    String(process.env.TEACHER_BRAIN_VTIA_LOG || "").trim() === "1"
  );
}

function normalizeBlockType(block) {
  return String(block?.type || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function blockInstructionText(block) {
  return [block?.title, block?.content, block?.text, block?.question, block?.caption]
    .filter(Boolean)
    .join(" ");
}

function snippet(text = "", max = 120) {
  const clean = String(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function isBiologyLesson(ctx = {}) {
  const subject = String(ctx.subject || "").trim();
  const topicKey = String(ctx.topicKey || "").trim();
  if (/biology/i.test(subject)) return true;
  return /aqa-gcse-biology|biology/i.test(topicKey);
}

function hasBiologyTopicBoost(ctx = {}) {
  if (isRequiredPracticalMode(ctx)) return true;
  const hay = [ctx.topic, ctx.subTopic, ctx.topicKey].filter(Boolean).join(" ");
  return BIOLOGY_TOPIC_BOOST.test(hay);
}

function countTeacherFirstKnowledgeSlots(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const found = new Set();
  for (const block of blocks) {
    const slot = classifyBlockToArchitectureSlot(block);
    if (TEACHER_FIRST_KNOWLEDGE_SLOTS.includes(slot)) {
      found.add(slot);
    }
  }
  return found.size;
}

function isTeacherFirstLessonShape(pages) {
  return countTeacherFirstKnowledgeSlots(pages) >= 3;
}

function resolveLessonCategory(ctx = {}, pages = []) {
  if (isRequiredPracticalMode(ctx)) return "required_practical";
  if (isTeacherFirstLessonShape(pages)) return "teacher_first";
  return "unknown";
}

function isInVtiaScope(ctx = {}, pages = []) {
  if (!isBiologyLesson(ctx)) {
    return { inScope: false, reason: "not_biology" };
  }
  if (isRequiredPracticalMode(ctx)) {
    return { inScope: true, reason: "required_practical" };
  }
  if (isTeacherFirstLessonShape(pages)) {
    return { inScope: true, reason: "teacher_first_structure" };
  }
  return { inScope: false, reason: "not_biology_teacher_first_or_rp" };
}

function resolveSlotKey(block) {
  const role = String(block?.role || "").trim();
  if (role) return role;
  return classifyBlockToArchitectureSlot(block);
}

function hasImperativeVisualTask(text = "") {
  const t = String(text);
  return (
    /\b(label|place|match|drag|drop)\b/i.test(t) &&
    !DESCRIPTIVE_EXCLUDES.some((re) => re.test(t))
  );
}

function isTeacherScaffoldingOnly(text = "") {
  const t = String(text);
  if (DESCRIPTIVE_EXCLUDES.some((re) => re.test(t))) return true;
  if (/\bthis labelled diagram shows\b/i.test(t)) return true;
  if (/\bthe diagram below shows\b/i.test(t) && !/\blabel\b/i.test(t)) return true;
  return false;
}

function isGraphAxisLabelOnly(block, text = "") {
  const type = normalizeBlockType(block);
  return type === "graph" && GRAPH_AXIS_EXCLUDE.test(text);
}

function isVariablesMatchBlock(block) {
  const type = normalizeBlockType(block);
  const role = String(block?.role || "").toLowerCase();
  return type === "dragdropmatch" && (role === "match" || role === "variablesmatch");
}

function blockPassesSolvabilityContract(block) {
  const type = normalizeBlockType(block);

  if (isVariablesMatchBlock(block)) return true;

  if (type === "interactivesequence") {
    const steps = block?.steps || block?.items || [];
    return Array.isArray(steps) && steps.length >= 3;
  }

  if (type === "dragdropmatch") {
    const matchMode = String(block?.matchMode || "").toLowerCase();
    if (matchMode === "diagram" || matchMode === "image") return true;
    if (block?.imageUrl || block?.diagramUrl) return true;
    const pairs = block?.pairs || block?.items || [];
    return Array.isArray(pairs) && pairs.length > 0 && !matchMode.includes("diagram");
  }

  if (type === "interactivediagram" || type === "hotspot" || type === "labeldiagram") {
    const hasImage = Boolean(block?.imageUrl || block?.diagramUrl);
    const hotspots = block?.hotspots || block?.labels || block?.zones || [];
    const hasGeometry = Array.isArray(hotspots) && hotspots.length > 0;
    return hasImage && hasGeometry;
  }

  if (type === "diagram") {
    return Boolean(block?.imageUrl || block?.diagramUrl || block?.src);
  }

  return false;
}

function hasVisualContractIncomplete(block, text = "") {
  const type = normalizeBlockType(block);
  if (!SOLVABLE_VISUAL_TYPES.has(type) && type !== "diagram") return false;
  if (blockPassesSolvabilityContract(block)) return false;
  if (!hasImperativeVisualTask(text) && !/\blabel\b/i.test(text)) return false;
  if (type === "interactivediagram" || type === "hotspot" || type === "labeldiagram") {
    const hasImage = Boolean(block?.imageUrl || block?.diagramUrl);
    return !hasImage || !blockPassesSolvabilityContract(block);
  }
  return false;
}

function detectExplainProse(text = "") {
  if (!EXPLAIN_PROSE_PATTERN.test(text)) return false;
  if (/\blabel\b/i.test(text)) return false;
  return true;
}

function detectMatchLabelsToImage(text = "") {
  return MATCH_LABELS_PATTERNS.some((re) => re.test(text));
}

function detectLabelPathway(text = "") {
  if (!/\blabel\b/i.test(text)) return false;
  if (/\b(explain|link|describe|outline|state)\b/i.test(text) && !/\blabel the\b/i.test(text)) {
    return false;
  }
  return LABEL_PATHWAY_PATTERNS.some((re) => re.test(text));
}

function detectLabelDiagram(text = "") {
  if (!/\blabel\b/i.test(text)) return false;
  if (DESCRIPTIVE_EXCLUDES.some((re) => re.test(text))) return false;
  return LABEL_DIAGRAM_PATTERNS.some((re) => re.test(text));
}

function detectV1Intent(text = "") {
  if (detectMatchLabelsToImage(text)) {
    return { intent: "MATCH_LABELS_TO_IMAGE", matchedPatterns: ["match_labels_phrase"] };
  }
  if (detectLabelPathway(text)) {
    return { intent: "LABEL_PATHWAY", matchedPatterns: ["label_pathway_phrase"] };
  }
  if (detectLabelDiagram(text)) {
    return { intent: "LABEL_DIAGRAM", matchedPatterns: ["label_diagram_phrase"] };
  }
  return null;
}

function scoreConfidence(intent, text = "", ctx = {}) {
  if (!intent) return "low";
  const imperative = hasImperativeVisualTask(text);
  const biologyBoost = hasBiologyTopicBoost(ctx);
  if (!imperative) return biologyBoost ? "medium" : "low";
  if (biologyBoost) return "high";
  return "medium";
}

function expectedInteractionFamilies(intent) {
  if (intent === "MATCH_LABELS_TO_IMAGE") return ["textToImage", "dragDropDiagram"];
  if (intent === "LABEL_PATHWAY") return ["textToImage", "interactiveSequence"];
  if (intent === "LABEL_DIAGRAM") return ["textToImage", "interactiveDiagram"];
  return [];
}

function auditBlockForVtia(block, blockIndex, ctx = {}) {
  const text = blockInstructionText(block);
  const hay = normalizeText(text);
  const slotKey = resolveSlotKey(block);
  const blockType = normalizeBlockType(block) || "unknown";

  if (blockPassesSolvabilityContract(block)) {
    return { kind: "pass", blockIndex, slotKey, blockType };
  }

  if (isGraphAxisLabelOnly(block, text)) {
    return { kind: "pass", blockIndex, slotKey, blockType };
  }

  if (isTeacherScaffoldingOnly(text)) {
    return { kind: "pass", blockIndex, slotKey, blockType };
  }

  if (hasVisualContractIncomplete(block, text)) {
    return {
      kind: "visual_contract_incomplete",
      blockIndex,
      slotKey,
      blockType,
      instructionSnippet: snippet(text),
    };
  }

  if (detectExplainProse(text)) {
    return {
      kind: "suppressor",
      blockIndex,
      slotKey,
      blockType,
      suppressor: "EXPLAIN_PROSE",
      instructionSnippet: snippet(text),
    };
  }

  const detected = detectV1Intent(text);
  if (!detected) {
    return { kind: "pass", blockIndex, slotKey, blockType };
  }

  const confidence = scoreConfidence(detected.intent, text, ctx);
  const finding = {
    blockIndex,
    slotKey,
    blockType,
    intent: detected.intent,
    confidence,
    instructionSnippet: snippet(text),
    matchedPatterns: detected.matchedPatterns,
    expectedInteractionFamilies: expectedInteractionFamilies(detected.intent),
  };

  if (confidence === "high") {
    finding.violation = "UNSOLVABLE_VISUAL_TASK";
  }

  return { kind: "finding", ...finding };
}

function buildVtiaTelemetry(input = {}) {
  if (!isVtiaTelemetryEnabled()) {
    return { enabled: false, scope: "disabled", reason: "TEACHER_BRAIN_VTIA not set to 0" };
  }

  const ctx = {
    topic: input.topic || "",
    subTopic: input.subTopic || input.topic || "",
    topicKey: input.topicKey || "",
    subject: input.subject || "Biology",
  };
  const pages = input.pages || [];
  const scopeCheck = isInVtiaScope(ctx, pages);

  if (!scopeCheck.inScope) {
    return {
      enabled: false,
      mode: "report_only",
      taxonomyVersion: TAXONOMY_VERSION,
      scope: "out_of_scope",
      reason: scopeCheck.reason,
    };
  }

  const blocks = flattenPagesToBlocks(pages);
  const findings = [];
  const suppressorHits = [];
  const visualContractIncomplete = [];
  let passBlocks = 0;
  let mediumConfidenceSignals = 0;
  let lowConfidenceSignals = 0;

  for (let i = 0; i < blocks.length; i++) {
    const result = auditBlockForVtia(blocks[i], i, ctx);
    if (result.kind === "pass") {
      passBlocks += 1;
      continue;
    }
    if (result.kind === "suppressor") {
      suppressorHits.push({
        blockIndex: result.blockIndex,
        slotKey: result.slotKey,
        blockType: result.blockType,
        suppressor: result.suppressor,
        instructionSnippet: result.instructionSnippet,
      });
      continue;
    }
    if (result.kind === "visual_contract_incomplete") {
      visualContractIncomplete.push({
        blockIndex: result.blockIndex,
        slotKey: result.slotKey,
        blockType: result.blockType,
        category: "VISUAL_CONTRACT_INCOMPLETE",
        instructionSnippet: result.instructionSnippet,
      });
      continue;
    }
    if (result.kind === "finding") {
      const { kind, ...finding } = result;
      findings.push(finding);
      if (finding.confidence === "medium") mediumConfidenceSignals += 1;
      if (finding.confidence === "low") lowConfidenceSignals += 1;
    }
  }

  const highConfidenceViolations = findings.filter((f) => f.violation === "UNSOLVABLE_VISUAL_TASK");

  const telemetry = {
    enabled: true,
    mode: "report_only",
    taxonomyVersion: TAXONOMY_VERSION,
    scope: scopeCheck.reason,
    lessonCategory: resolveLessonCategory(ctx, pages),
    topicKey: ctx.topicKey || null,
    blocksScanned: blocks.length,
    findings,
    suppressorHits,
    visualContractIncomplete,
    summary: {
      highConfidenceViolations: highConfidenceViolations.length,
      mediumConfidenceSignals,
      lowConfidenceSignals,
      suppressorHits: suppressorHits.length,
      visualContractIncomplete: visualContractIncomplete.length,
      passBlocks,
    },
  };

  if (isVtiaLogEnabled()) {
    const viol = telemetry.summary.highConfidenceViolations;
    const top = highConfidenceViolations[0];
    console.log(
      `[VTIA] topicKey=${ctx.topicKey || "(none)"} violations=${viol}` +
        (top
          ? ` slot=${top.slotKey} intent=${top.intent}`
          : "")
    );
  }

  return telemetry;
}

function auditSingleBlockForVtia(block, ctx = {}, blockIndex = 0) {
  const saved = process.env.TEACHER_BRAIN_VTIA;
  process.env.TEACHER_BRAIN_VTIA = "0";
  try {
    const result = auditBlockForVtia(block, blockIndex, ctx);
    return result;
  } finally {
    if (saved === undefined) delete process.env.TEACHER_BRAIN_VTIA;
    else process.env.TEACHER_BRAIN_VTIA = saved;
  }
}

/**
 * Compute per-intent precision from curated fixture corpus.
 * Precision = TP / (TP + FP) for high-confidence violation predictions.
 *
 * @param {object[]} fixtures — { block, ctx, groundTruth: { shouldViolate, intent? } }
 */
function computeIntentPrecisionEstimate(fixtures = []) {
  const stats = {};
  for (const intent of V1_INTENTS) {
    stats[intent] = { truePositive: 0, falsePositive: 0, groundTruthPositive: 0 };
  }

  for (const fixture of fixtures) {
    const subject = fixture.subject || fixture.ctx?.subject || "Biology";
    if (!/biology/i.test(subject)) continue;

    const block = fixture.block || {};
    const ctx = {
      topic: fixture.topic || fixture.ctx?.topic || "",
      subTopic: fixture.subTopic || fixture.ctx?.subTopic || "",
      topicKey: fixture.topicKey || fixture.ctx?.topicKey || "",
      subject: fixture.subject || fixture.ctx?.subject || "Biology",
    };
    const gt = fixture.groundTruth || {};
    const result = auditSingleBlockForVtia(block, ctx, 0);

    const predictedViolate =
      result.kind === "finding" &&
      result.confidence === "high" &&
      result.violation === "UNSOLVABLE_VISUAL_TASK";
    const predictedIntent = predictedViolate ? result.intent : null;

    if (gt.shouldViolate && gt.intent && stats[gt.intent]) {
      stats[gt.intent].groundTruthPositive += 1;
    }

    if (predictedViolate && predictedIntent && stats[predictedIntent]) {
      if (gt.shouldViolate && gt.intent === predictedIntent) {
        stats[predictedIntent].truePositive += 1;
      } else {
        stats[predictedIntent].falsePositive += 1;
      }
    }
  }

  const intentPrecisionEstimate = {};
  for (const intent of V1_INTENTS) {
    const { truePositive, falsePositive, groundTruthPositive } = stats[intent];
    const denom = truePositive + falsePositive;
    intentPrecisionEstimate[intent] = {
      truePositive,
      falsePositive,
      groundTruthPositive,
      precisionPct: denom > 0 ? Math.round((truePositive / denom) * 1000) / 10 : null,
      precisionLabel:
        denom > 0 ? `${Math.round((truePositive / denom) * 1000) / 10}%` : "n/a (no predictions)",
    };
  }

  return intentPrecisionEstimate;
}

function topOffendingSlots(findings = [], limit = 10) {
  const counts = new Map();
  for (const f of findings) {
    if (f.violation !== "UNSOLVABLE_VISUAL_TASK") continue;
    const key = f.slotKey || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([slotKey, count]) => ({ slotKey, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function aggregateVtiaTelemetry(perLesson = [], fixtures = []) {
  const inScope = perLesson.filter((l) => l.vtiaTelemetry?.enabled);
  const allFindings = inScope.flatMap((l) => l.vtiaTelemetry.findings || []);
  const highViolations = allFindings.filter((f) => f.violation === "UNSOLVABLE_VISUAL_TASK");

  const violationCountsByIntent = {};
  for (const intent of V1_INTENTS) violationCountsByIntent[intent] = 0;
  for (const f of highViolations) {
    if (violationCountsByIntent[f.intent] !== undefined) {
      violationCountsByIntent[f.intent] += 1;
    }
  }

  const lessonCategoriesAffected = {};
  for (const l of inScope) {
    const cat = l.vtiaTelemetry.lessonCategory || "unknown";
    const violCount = (l.vtiaTelemetry.findings || []).filter(
      (f) => f.violation === "UNSOLVABLE_VISUAL_TASK"
    ).length;
    if (violCount > 0) {
      lessonCategoriesAffected[cat] = (lessonCategoriesAffected[cat] || 0) + 1;
    }
  }

  const confidenceDistribution = { high: 0, medium: 0, low: 0 };
  for (const f of allFindings) {
    if (f.confidence && confidenceDistribution[f.confidence] !== undefined) {
      confidenceDistribution[f.confidence] += 1;
    }
  }

  const lessonsWithHighConfidenceViolation = inScope.filter((l) =>
    (l.vtiaTelemetry.findings || []).some((f) => f.violation === "UNSOLVABLE_VISUAL_TASK")
  ).length;

  const violationRatePct =
    inScope.length > 0
      ? Math.round((lessonsWithHighConfidenceViolation / inScope.length) * 1000) / 10
      : 0;

  const intentPrecisionEstimate = computeIntentPrecisionEstimate(fixtures);

  let highConfidenceWithSuppressorNearby = 0;
  for (const l of inScope) {
    const vt = l.vtiaTelemetry;
    const violBlocks = new Set(
      (vt.findings || [])
        .filter((f) => f.violation === "UNSOLVABLE_VISUAL_TASK")
        .map((f) => f.blockIndex)
    );
    for (const s of vt.suppressorHits || []) {
      for (const vb of violBlocks) {
        if (Math.abs(vb - s.blockIndex) <= 2) {
          highConfidenceWithSuppressorNearby += 1;
          break;
        }
      }
    }
  }

  const mediumTotal = confidenceDistribution.medium + confidenceDistribution.low + confidenceDistribution.high;
  const mediumConfidenceRatePct =
    mediumTotal > 0
      ? Math.round((confidenceDistribution.medium / mediumTotal) * 1000) / 10
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    mode: "VTIA=0_report_only",
    taxonomyVersion: TAXONOMY_VERSION,
    lessonsScanned: perLesson.length,
    lessonsInScope: inScope.length,
    lessonsWithHighConfidenceViolation,
    violationRatePct,
    violationCountsByIntent,
    lessonCategoriesAffected,
    topOffendingSlots: topOffendingSlots(highViolations),
    confidenceDistribution,
    intentPrecisionEstimate,
    falsePositiveRiskIndicators: {
      highConfidenceWithSuppressorNearby,
      mediumConfidenceRatePct,
      visualContractIncompleteCount: inScope.reduce(
        (n, l) => n + (l.vtiaTelemetry.visualContractIncomplete || []).length,
        0
      ),
    },
    perLesson: perLesson.map((l) => ({
      name: l.name,
      topicKey: l.topicKey,
      lessonCategory: l.vtiaTelemetry?.lessonCategory,
      highConfidenceViolations: l.vtiaTelemetry?.summary?.highConfidenceViolations ?? 0,
    })),
  };
}

function formatVtiaTelemetryLines(telemetry = {}) {
  if (!telemetry.enabled) {
    return [`VTIA: disabled (${telemetry.reason || "off"})`];
  }
  const lines = [
    `VTIA telemetry (${telemetry.taxonomyVersion}) — ${telemetry.lessonCategory || telemetry.scope}`,
    `High-confidence violations: ${telemetry.summary?.highConfidenceViolations ?? 0}`,
    `Suppressor hits: ${telemetry.summary?.suppressorHits ?? 0}`,
    `Visual contract incomplete: ${telemetry.summary?.visualContractIncomplete ?? 0}`,
  ];
  for (const f of telemetry.findings || []) {
    if (f.violation === "UNSOLVABLE_VISUAL_TASK") {
      lines.push(`  • [${f.intent}] ${f.slotKey}: ${f.instructionSnippet}`);
    }
  }
  return lines;
}

module.exports = {
  TAXONOMY_VERSION,
  V1_INTENTS,
  isVtiaTelemetryEnabled,
  isVtiaLogEnabled,
  isBiologyLesson,
  isTeacherFirstLessonShape,
  isInVtiaScope,
  blockPassesSolvabilityContract,
  detectV1Intent,
  detectExplainProse,
  auditBlockForVtia,
  buildVtiaTelemetry,
  computeIntentPrecisionEstimate,
  aggregateVtiaTelemetry,
  formatVtiaTelemetryLines,
  topOffendingSlots,
};
