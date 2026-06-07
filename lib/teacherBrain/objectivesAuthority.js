/**
 * Phase 3H.1.8b.1 — Objectives scope authority (profile-driven prompt + autofix + gate).
 * Mirrors keyWordsAuthority.js pattern for lesson objectives and framing fields.
 */

const { resolveSubTopicProfile } = require("./subTopicProfiles");
const { getSubTopicBoundaryMode } = require("./subTopicBoundaryGuard");
const {
  enforceObjectiveBoundaries,
  analyzeObjectiveItem,
  formatObjectiveBoundaryAppendix,
} = require("./objectiveBoundaryEnforcer");

/** Drift terms tracked in acceptance (sibling-topic leakage). */
const DRIFT_TERM_CHECKS = [
  { key: "cerebellum", re: /\bcerebellum\b/i },
  { key: "cortex", re: /\bcerebr(?:al\s+cortex|um)\b|\bcortex\b/i },
  { key: "medulla", re: /\bmedulla\b/i },
  { key: "thermoregulation", re: /\bthermoregulation\b/i },
  { key: "hypothalamus", re: /\bhypothalamus\b/i },
  { key: "accommodation", re: /\baccommodation\b/i },
  { key: "retina", re: /\bretina\b/i },
  { key: "lens", re: /\blens\b/i },
  { key: "iris", re: /\biris\b/i },
  { key: "pupil", re: /\bpupil\b/i },
];

function stripHtml(html = "") {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function findDriftTermsInText(text = "") {
  const hay = String(text || "");
  return DRIFT_TERM_CHECKS.filter((t) => t.re.test(hay)).map((t) => t.key);
}

function extractListItemsFromHtml(html = "") {
  const raw = String(html || "");
  const items = [];
  const seen = new Set();

  function pushItem(text) {
    const cleaned = stripHtml(text).replace(/^[\s•\-\*\d.)]+/, "").trim();
    if (!cleaned || cleaned.length < 8) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(cleaned);
  }

  raw.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    pushItem(inner);
    return "";
  });

  if (items.length === 0) {
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (/^[\s•\-\*]/.test(line) || /^\d+[\.)]\s/.test(trimmed)) {
        pushItem(trimmed);
      }
    }
  }

  return items;
}

function extractBlockTextByHeading(lessonText = "", headingRe) {
  const lines = String(lessonText || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(\d+)\s*[—\-–]\s+/i.test(line) && headingRe.test(line)) {
      start = i;
      break;
    }
    if (
      /^(\d+)\s*[—\-–]\s+/i.test(line) &&
      headingRe.test(lines.slice(i, i + 4).join("\n"))
    ) {
      start = i;
      break;
    }
  }
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i]) || /^PAGE\s+\d/i.test(lines[i].trim())) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function extractObjectivesBlockText(lessonText = "") {
  return extractBlockTextByHeading(lessonText, /\b(?:LESSON|REVISION)\s+OBJECTIVES\b/i);
}

function extractPriorKnowledgeBlockText(lessonText = "") {
  return extractBlockTextByHeading(lessonText, /\bPRIOR\s+KNOWLEDGE\b/i);
}

function extractShortSummaryField(lessonText = "") {
  const lines = String(lessonText || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^SHORT SUMMARY FIELD:/i.test(lines[i].trim())) {
      const parts = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (/^PAGE\s+\d/i.test(line) || /^(\d+)\s*[—\-–]\s+/i.test(line)) break;
        if (line) parts.push(line);
      }
      if (parts.length) return parts.join(" ").trim();
      const inline = lines[i].replace(/^SHORT SUMMARY FIELD:\s*/i, "").trim();
      if (inline) return inline;
    }
  }
  return "";
}

function setShortSummaryField(text = "", newValue = "") {
  const lines = String(text || "").split("\n");
  let fieldIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^SHORT SUMMARY FIELD:/i.test(lines[i].trim())) {
      fieldIdx = i;
      break;
    }
  }
  const value = String(newValue || "").trim();
  if (fieldIdx < 0) return text;

  let pageIdx = lines.length;
  for (let i = fieldIdx + 1; i < lines.length; i++) {
    if (/^PAGE\s+\d/i.test(lines[i].trim())) {
      pageIdx = i;
      break;
    }
  }

  const before = lines.slice(0, fieldIdx);
  const after = lines.slice(pageIdx);
  return [...before, `SHORT SUMMARY FIELD:`, value, "", ...after].join("\n").trimEnd();
}

function extractLessonObjectiveField(lessonText = "") {
  const lines = String(lessonText || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^LESSON OBJECTIVE FIELD:/i.test(lines[i].trim())) {
      const parts = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (/^SHORT SUMMARY FIELD:/i.test(line) || /^PAGE\s+\d/i.test(line)) break;
        if (line) parts.push(line);
      }
      if (parts.length) return parts.join(" ").trim();
      const inline = lines[i].replace(/^LESSON OBJECTIVE FIELD:\s*/i, "").trim();
      if (inline) return inline;
    }
  }
  return "";
}

function extractDownstreamSectionText(lessonText = "", headingRe) {
  return extractBlockTextByHeading(lessonText, headingRe);
}

function profileObjectiveBullets(profile) {
  if (!profile) return [];
  if (Array.isArray(profile.objectiveBullets) && profile.objectiveBullets.length) {
    return profile.objectiveBullets.map((b) => String(b).trim()).filter(Boolean);
  }
  return (profile.primaryConcepts || [])
    .slice(0, 5)
    .map((c) => `Explain ${c.name} and how structure links to function in this sub-topic.`);
}

function objectiveBulletsToHtml(bullets = []) {
  const rows = bullets
    .map((b) => {
      const text = stripHtml(b);
      if (!text) return "";
      if (/^👉/.test(text) || /<li/i.test(b)) return `<li>${b}</li>`;
      return `<li><strong>👉</strong> ${text.charAt(0).toUpperCase()}${text.slice(1)}</li>`;
    })
    .filter(Boolean);
  return [
    "<h2><strong>Revision objectives</strong></h2>",
    "<p>At the end of this lesson, you should be able to:</p>",
    `<ul>\n${rows.join("\n")}\n</ul>`,
  ].join("\n");
}

function replaceBlockBody(blockText = "", newBodyHtml = "") {
  const lines = String(blockText || "").split("\n");
  const headerEnd = lines.findIndex((l, idx) => idx > 0 && /^Paste into:/i.test(l.trim()));
  const bodyStart = headerEnd >= 0 ? headerEnd + 1 : 2;
  const header = lines.slice(0, bodyStart).join("\n").trimEnd();
  return `${header}\n${newBodyHtml.trim()}\n`;
}

function setLessonObjectiveField(text = "", newValue = "") {
  const lines = String(text || "").split("\n");
  let fieldIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^LESSON OBJECTIVE FIELD:/i.test(lines[i].trim())) {
      fieldIdx = i;
      break;
    }
  }
  const value = String(newValue || "").trim();
  if (fieldIdx < 0) {
    return `LESSON OBJECTIVE FIELD:\n${value}\n\n${text}`.trimEnd();
  }

  let summaryIdx = lines.length;
  for (let i = fieldIdx + 1; i < lines.length; i++) {
    if (/^SHORT SUMMARY FIELD:/i.test(lines[i].trim())) {
      summaryIdx = i;
      break;
    }
  }

  const before = lines.slice(0, fieldIdx);
  const after = lines.slice(summaryIdx);
  return [...before, `LESSON OBJECTIVE FIELD:`, value, "", ...after].join("\n").trimEnd();
}

function replaceBlockInLesson(lessonText = "", headingRe, newBlockText = "") {
  const lines = String(lessonText || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i]) && headingRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return lessonText;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i]) || /^PAGE\s+\d/i.test(lines[i].trim())) {
      end = i;
      break;
    }
  }

  const replacement = String(newBlockText || "").trim();
  return [...lines.slice(0, start), replacement, ...lines.slice(end)].join("\n").trimEnd();
}

function shouldApplyObjectiveAutofix(profile) {
  if (!profile) return false;
  const mode = getSubTopicBoundaryMode();
  if (mode >= 2) return true;
  if (String(process.env.TEACHER_BRAIN_OBJECTIVES_AUTHORITY || "1").trim() === "1") {
    return true;
  }
  return false;
}

/**
 * Mandatory SS1 objectives section for prompt (Layer 2 scope authority).
 * @param {import("./subTopicProfiles").SubTopicProfile|null} profile
 */
function buildSs1Layer2MandatoryObjectivesSection(profile) {
  if (!profile) return "";

  const bullets = profileObjectiveBullets(profile);
  if (!bullets.length) return "";

  const forbidden = [
    "cerebral cortex",
    "cerebellum",
    "medulla",
    "brain regions",
    "eye structure",
    "accommodation",
    "thermoregulation",
    "hypothalamus",
    "full reflex arc pathway",
    "retina",
    "iris",
    "pupil",
    "lens shape",
  ];

  const lines = [
    "--------------------------------",
    "TEACHER-FIRST LAYER 2 — MANDATORY OBJECTIVES (SS1 SCOPE AUTHORITY)",
    "--------------------------------",
    "",
    "Block 1 REVISION OBJECTIVES and LESSON OBJECTIVE FIELD must stay inside this sub-topic ONLY.",
    "",
    "Use objectives like these (adapt wording; keep scope):",
    ...bullets.map((b) => `- ${b}`),
    "",
    "FORBIDDEN in objectives, prior knowledge bullets, LESSON OBJECTIVE FIELD, and SHORT SUMMARY FIELD:",
    ...forbidden.map((f) => `- ${f}`),
    "",
    "Neighbouring topics (reflex arc detail, brain regions, eye, thermoregulation) belong in other lessons — mention CNS/brain/spinal cord only as parts of the nervous system, not as lesson objectives.",
  ];

  return lines.join("\n");
}

/**
 * Autofix: rewrite contaminated objectives / prior knowledge / LESSON OBJECTIVE FIELD.
 */
function ensureObjectiveScopeCompliance(
  text = "",
  { topic = "", topicKey = "", subTopic = "" } = {},
  fixes = []
) {
  const profile = resolveSubTopicProfile({
    topicKey,
    topic,
    subTopic: subTopic || topic,
  });

  if (!profile || !shouldApplyObjectiveAutofix(profile)) {
    return { text, changed: false, profile, enforcementResult: null };
  }

  const objectiveField = extractLessonObjectiveField(text);
  const objectiveItems = extractListItemsFromHtml(extractObjectivesBlockText(text));
  const priorItems = extractListItemsFromHtml(extractPriorKnowledgeBlockText(text));

  const fieldItems = objectiveField ? [objectiveField] : [];

  const result = enforceObjectiveBoundaries({
    objectives: objectiveItems.length ? objectiveItems : fieldItems,
    priorKnowledge: priorItems,
    subTopicProfile: profile,
    applyChanges: true,
    boundaryMode: 2,
  });

  let working = text;
  let changed = false;

  if (result.changed || result.outOfScopeObjectiveCount > 0) {
    if (objectiveItems.length && result.cleanedObjectives.length) {
      const objBlock = extractObjectivesBlockText(working);
      if (objBlock) {
        const headerMatch = objBlock.match(/^(\d+\s*[—\-–]\s+[^\n]+\nPaste into:[^\n]+)/i);
        const header = headerMatch ? headerMatch[1] : "1 — REVISION OBJECTIVES\nPaste into: Text (concept)";
        const newBlock = replaceBlockBody(header, objectiveBulletsToHtml(result.cleanedObjectives));
        working = replaceBlockInLesson(working, /\b(?:LESSON|REVISION)\s+OBJECTIVES\b/i, newBlock);
        changed = true;
      }
    }

    if (priorItems.length && result.cleanedPriorKnowledge.length) {
      const pkBlock = extractPriorKnowledgeBlockText(working);
      if (pkBlock) {
        const headerMatch = pkBlock.match(/^(\d+\s*[—\-–]\s+[^\n]+\nPaste into:[^\n]+)/i);
        const header = headerMatch ? headerMatch[1] : "2 — PRIOR KNOWLEDGE\nPaste into: Text (concept)";
        const body = [
          "<h2><strong>Prior knowledge</strong></h2>",
          "<p>Before we start, you should already know:</p>",
          `<ul>\n${result.cleanedPriorKnowledge
            .map((b) => `<li>${stripHtml(b)}</li>`)
            .join("\n")}\n</ul>`,
        ].join("\n");
        const newBlock = replaceBlockBody(header, body);
        working = replaceBlockInLesson(working, /\bPRIOR\s+KNOWLEDGE\b/i, newBlock);
        changed = true;
      }
    }

    const fieldAnalysis = objectiveField
      ? analyzeObjectiveItem(objectiveField, profile)
      : { contaminated: false };
    if (fieldAnalysis.contaminated || findDriftTermsInText(objectiveField).length) {
      const replacement =
        profile.lessonObjectiveField ||
        result.cleanedObjectives[0] ||
        profileObjectiveBullets(profile)[0] ||
        "Stay within the selected sub-topic scope.";
      working = setLessonObjectiveField(working, replacement);
      changed = true;
    }

    const summaryField = extractShortSummaryField(working);
    const summaryAnalysis = summaryField
      ? analyzeObjectiveItem(summaryField, profile)
      : { contaminated: false };
    if (summaryAnalysis.contaminated || findDriftTermsInText(summaryField).length) {
      const summaryReplacement =
        profile.lessonObjectiveField ||
        `This lesson covers neurone structure, the CNS and PNS, and how electrical impulses coordinate rapid responses.`;
      working = setShortSummaryField(working, summaryReplacement);
      changed = true;
    }

    if (changed) {
      fixes.push(
        `Objectives scope authority: rewrote ${result.outOfScopeObjectiveCount} out-of-scope framing item(s).`
      );
    }
  } else if (objectiveField && findDriftTermsInText(objectiveField).length) {
    const replacement =
      profile.lessonObjectiveField ||
      profileObjectiveBullets(profile)[0] ||
      "Stay within the selected sub-topic scope.";
    working = setLessonObjectiveField(working, replacement);
    changed = true;
    fixes.push("Objectives scope authority: rewrote contaminated LESSON OBJECTIVE FIELD.");
  }

  const summaryFieldFinal = extractShortSummaryField(working);
  if (
    summaryFieldFinal &&
    (analyzeObjectiveItem(summaryFieldFinal, profile).contaminated ||
      findDriftTermsInText(summaryFieldFinal).length)
  ) {
    working = setShortSummaryField(
      working,
      profile.lessonObjectiveField ||
        "This lesson covers neurone structure, the CNS and PNS, and how electrical impulses coordinate rapid responses."
    );
    if (!changed) {
      fixes.push("Objectives scope authority: rewrote contaminated SHORT SUMMARY FIELD.");
    }
    changed = true;
  }

  return { text: working, changed, profile, enforcementResult: result };
}

function collectObjectiveHaystack(lessonText = "") {
  return [
    extractLessonObjectiveField(lessonText),
    extractShortSummaryField(lessonText),
    extractObjectivesBlockText(lessonText),
    extractPriorKnowledgeBlockText(lessonText),
  ].join("\n");
}

function evaluateObjectivesAuthorityGate(lessonText = "", meta = {}) {
  const profile =
    meta.subTopicProfile ||
    resolveSubTopicProfile({
      topicKey: meta.topicKey,
      topic: meta.topic,
      subTopic: meta.subTopic || meta.topic,
    });

  const haystack = collectObjectiveHaystack(lessonText);
  const driftTermsFound = findDriftTermsInText(haystack);

  const objectiveItems = extractListItemsFromHtml(extractObjectivesBlockText(lessonText));
  const priorItems = extractListItemsFromHtml(extractPriorKnowledgeBlockText(lessonText));
  const objectiveField = extractLessonObjectiveField(lessonText);

  const violations = [];
  if (profile) {
    for (const item of [...objectiveItems, ...priorItems, objectiveField].filter(Boolean)) {
      const analysis = analyzeObjectiveItem(item, profile);
      if (analysis.contaminated) {
        violations.push({
          text: item.slice(0, 120),
          conceptId: analysis.primaryConceptId,
          violationType: analysis.violationType,
          reason: analysis.reason,
        });
      }
    }
  }

  const warnings = [];
  if (driftTermsFound.length) {
    warnings.push(`Drift terms in objectives framing: ${driftTermsFound.join(", ")}.`);
  }
  if (violations.length) {
    warnings.push(`${violations.length} out-of-scope objective/prior-knowledge item(s) remain.`);
  }
  if (meta.usedScopeAutofix && !meta.scopeAutofixChanged) {
    warnings.push("Scope autofix ran but made no changes.");
  }

  const pass = driftTermsFound.length === 0 && violations.length === 0;

  return {
    pass,
    driftTermsFound,
    violations,
    warnings,
    objectiveCount: objectiveItems.length,
    priorKnowledgeCount: priorItems.length,
    lessonObjectiveField: objectiveField,
    objectives: objectiveItems,
    priorKnowledge: priorItems,
  };
}

function scanDownstreamDrift(lessonText = "") {
  const sections = {
    examPractice: extractDownstreamSectionText(lessonText, /\bEXAM\s+PRACTICE\b/i),
    checkpoints: [
      extractDownstreamSectionText(lessonText, /\bCHECKPOINT\b/i),
      extractDownstreamSectionText(lessonText, /\bQUICK\s+CHECK\b/i),
    ].join("\n"),
    summary: extractDownstreamSectionText(lessonText, /\bSUMMARY\b/i),
    memoryRule: extractDownstreamSectionText(
      lessonText,
      /\bFINAL\s+MEMORY\s+RULE\b|\bKEY\s+INSIGHT\b/i
    ),
  };

  const out = {};
  for (const [key, text] of Object.entries(sections)) {
    out[key] = findDriftTermsInText(text);
  }
  return out;
}

module.exports = {
  DRIFT_TERM_CHECKS,
  findDriftTermsInText,
  extractObjectivesBlockText,
  extractPriorKnowledgeBlockText,
  extractLessonObjectiveField,
  extractShortSummaryField,
  extractListItemsFromHtml,
  buildSs1Layer2MandatoryObjectivesSection,
  ensureObjectiveScopeCompliance,
  evaluateObjectivesAuthorityGate,
  scanDownstreamDrift,
  profileObjectiveBullets,
  formatObjectiveBoundaryAppendix,
};
