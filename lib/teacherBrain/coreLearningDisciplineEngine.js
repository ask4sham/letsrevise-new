/**
 * Phase 3H.1.8b.3d — Core Learning Discipline V1 (prompt-only + read-only scoring).
 * Reduces repetition and enforces explanation progression — no structure mutation.
 */

const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const {
  getSs1BlockNumber,
  isTeacherFirstSs1Enabled,
} = require("./teacherFirstSs1Architecture");
const { isTeachingQualityUpgradeEnabled } = require("./reasoningChainEngine");
const { stripHtml } = require("./workedReasoningEngine");
const { extractBlockBodies } = require("./grade89ChallengeEngine");

const CORE_LEARNING_DISCIPLINE_MARKER = "CORE LEARNING DISCIPLINE V1 (3H.1.8b.3d):";

const DEFINITION_RX =
  /\b(is defined as|means that|means|is the process|refers to|can be defined|definition:|is when)\b/i;

const MECHANISM_RX =
  /\b(because|therefore|leading to|results in|causes|mechanism|pathway|transmits?|detects?|activates?|coordinates?|refracts?|evaporates?|feedback)\b/i;

const APPLICATION_RX =
  /\b(for example|in practice|during exercise|when|scenario|application|real.?world|case study|data shows?)\b/i;

const EVALUATION_RX =
  /\b(evaluate|compare|assess|justify|analyse|analyze|therefore|consequently|conclusion|to what extent)\b/i;

const RECALL_ONLY_RX =
  /\b(state the|name the|list the|define the|what is a|describe what|identify the)\b/i;

const EXAM_APPLICATION_RX =
  /\b(explain how|evaluate|compare|analyse|analyze|justify|assess|suggest why|to what extent)\b/i;

const DIAGRAM_CAPTION_RX =
  /\b(notice|shown|diagram|process|important|focus on|label|indicates?|illustrates?)\b/i;

const SUMMARY_TAKEAWAY_RX =
  /\b(examiner|takeaway|remember|key point|in conclusion|overall|therefore|full marks)\b/i;

const EXTENDED_BLOCK_PATTERNS = [
  { key: "definition", rx: /^definition$|key\s+definition/i },
  { key: "coreModel", rx: /core\s+model|core\s+rule/i },
  { key: "coreTeaching", rx: /core\s+teaching|core\s+learning/i },
  { key: "visualExplanation", rx: /visual\s+explanation|main\s+diagram|diagram/i },
  { key: "workedExample", rx: /worked\s+example/i },
  { key: "examPractice", rx: /exam\s+practice/i },
  { key: "summary", rx: /^summary$/i },
];

function isCoreLearningDisciplineEnabled() {
  return (
    isTeachingQualityUpgradeEnabled() &&
    isTeacherFirstSs1Enabled() &&
    String(process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1 || "0").trim() === "1"
  );
}

function extractExtendedBlockBodies(text = "") {
  const base = extractBlockBodies(text);
  const lines = String(text || "").split("\n");
  const bodies = { ...base };
  let i = 0;
  while (i < lines.length) {
    const header = lines[i].match(/^(\d+)\s*[—\-–]\s+(.+)$/i);
    if (!header) {
      i += 1;
      continue;
    }
    const title = header[2].trim();
    const match = EXTENDED_BLOCK_PATTERNS.find((p) => p.rx.test(title));
    if (match && !bodies[match.key]) {
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^(\d+)\s*[—\-–]\s+/i.test(lines[j]) || /^PAGE\s+\d/i.test(lines[j].trim())) {
          end = j;
          break;
        }
      }
      const chunk = lines.slice(i, end);
      const pasteIdx = chunk.findIndex((l) => /^Paste into:/i.test(l.trim()));
      const body =
        pasteIdx >= 0 ? chunk.slice(pasteIdx + 1).join("\n") : chunk.slice(2).join("\n");
      bodies[match.key] = body.trim();
    }
    i += 1;
  }
  return bodies;
}

function significantTokens(text = "") {
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/<[^>]+>/g, " ")
      .split(/\W+/)
      .filter((w) => w.length > 4)
  );
}

function jaccardSimilarity(a = "", b = "") {
  const setA = significantTokens(a);
  const setB = significantTokens(b);
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

function termDefinedIn(text = "", term = "") {
  const plain = stripHtml(text).toLowerCase();
  const t = String(term || "").toLowerCase().trim();
  if (!t || !plain.includes(t)) return false;
  const idx = plain.indexOf(t);
  const window = plain.slice(Math.max(0, idx - 40), idx + t.length + 80);
  return DEFINITION_RX.test(window);
}

function findRepeatedDefinitions(bodies = {}, profile = null) {
  const terms = profile?.coreLearningDiscipline?.canonicalTerms || [];
  const violations = [];
  const definedIn = {};

  for (const term of terms) {
    for (const [key, body] of Object.entries(bodies)) {
      if (!body || !termDefinedIn(body, term)) continue;
      if (!definedIn[term]) {
        definedIn[term] = key;
      } else {
        violations.push(
          `"${term}" defined in both ${definedIn[term]} and ${key} — later sections must extend, not redefine.`
        );
      }
    }
  }
  return { violations, definedIn, repeatCount: violations.length };
}

function scoreProgression(bodies = {}, profile = null) {
  const stages = profile?.coreLearningDiscipline?.progressionMap || {};
  const violations = [];
  let hits = 0;
  let total = 0;

  const stageChecks = {
    definition: DEFINITION_RX,
    overview: /→|pathway|model|sequence|receptor|cornea|stimulus/i,
    mechanism: MECHANISM_RX,
    application: APPLICATION_RX,
    evaluation: EVALUATION_RX,
    takeaway: SUMMARY_TAKEAWAY_RX,
  };

  for (const [blockKey, stage] of Object.entries(stages)) {
    const body = bodies[blockKey];
    if (!body) continue;
    total += 1;
    const plain = stripHtml(body);
    const rx = stageChecks[stage];
    if (rx && rx.test(plain)) {
      hits += 1;
    } else {
      violations.push(
        `Block ${blockKey} should advance to ${stage} stage but lacks expected progression language.`
      );
    }
  }

  return { hits, total, violations };
}

function scoreDiagramComplementarity(bodies = {}) {
  const violations = [];
  const diagram = bodies.visualExplanation || "";
  const nearby = bodies.coreTeaching || bodies.coreModel || "";
  if (!diagram || !nearby) {
    return { skipped: true, overlapPct: 0, hasCaptionFocus: false, violations: [] };
  }

  const overlap = jaccardSimilarity(diagram, nearby);
  const plain = stripHtml(diagram).toLowerCase();
  const hasCaptionFocus = DIAGRAM_CAPTION_RX.test(plain);

  if (overlap > 0.55) {
    violations.push(
      "Diagram explanation overlaps nearby text by more than 55% — captions must complement, not repeat."
    );
  }
  if (!hasCaptionFocus) {
    violations.push(
      "Diagram caption lacks focus language (what to notice / process shown / why it matters)."
    );
  }

  return { skipped: false, overlapPct: Math.round(overlap * 100), hasCaptionFocus, violations };
}

function scoreSummaryDiscipline(bodies = {}) {
  const summary = bodies.summary || "";
  if (!summary) {
    return { skipped: true, overlapPct: 0, hasTakeaways: false, violations: [] };
  }

  const earlier = [bodies.definition, bodies.coreModel, bodies.coreTeaching, bodies.workedExample]
    .filter(Boolean)
    .join("\n");
  const overlap = jaccardSimilarity(summary, earlier);
  const plain = stripHtml(summary).toLowerCase();
  const hasTakeaways = SUMMARY_TAKEAWAY_RX.test(plain);
  const violations = [];

  if (overlap > 0.5) {
    violations.push("Summary repeats earlier lesson content — use final takeaways and examiner conclusions only.");
  }
  if (!hasTakeaways) {
    violations.push("Summary lacks examiner takeaways or conclusion framing.");
  }

  return { skipped: false, overlapPct: Math.round(overlap * 100), hasTakeaways, violations };
}

function scoreExamPracticeDiscipline(bodies = {}) {
  const exam = bodies.examPractice || "";
  if (!exam) {
    return { skipped: true, recallOnly: false, applicationCount: 0, violations: [] };
  }

  const plain = stripHtml(exam).toLowerCase();
  const recallOnly = RECALL_ONLY_RX.test(plain);
  const applicationCount = (plain.match(EXAM_APPLICATION_RX) || []).length;
  const violations = [];

  if (recallOnly && applicationCount < 1) {
    violations.push("Exam practice uses recall-only stems — must test application, analysis, or evaluation.");
  }
  if (applicationCount < 1) {
    violations.push("Exam practice lacks application/analysis/evaluation command words.");
  }

  return { skipped: false, recallOnly, applicationCount, violations };
}

function scoreMechanismRepetition(bodies = {}) {
  const sources = [
    { key: "coreTeaching", body: bodies.coreTeaching },
    { key: "workedExample", body: bodies.workedExample },
    { key: "examPractice", body: bodies.examPractice },
  ].filter((s) => s.body);

  const violations = [];
  for (let i = 0; i < sources.length; i += 1) {
    for (let j = i + 1; j < sources.length; j += 1) {
      const overlap = jaccardSimilarity(sources[i].body, sources[j].body);
      const bothMechanism =
        MECHANISM_RX.test(stripHtml(sources[i].body)) &&
        MECHANISM_RX.test(stripHtml(sources[j].body));
      if (bothMechanism && overlap > 0.45) {
        violations.push(
          `Mechanism explanation repeated between ${sources[i].key} and ${sources[j].key} (${Math.round(overlap * 100)}% overlap).`
        );
      }
    }
  }
  return { violations, repeatCount: violations.length };
}

function buildCoreLearningDisciplineAppendix(profile) {
  if (!isCoreLearningDisciplineEnabled() || !profile?.coreLearningDiscipline) return "";

  const cld = profile.coreLearningDiscipline;
  const blocks = {
    definition: getSs1BlockNumber("definition") || 5,
    coreModel: getSs1BlockNumber("coreModel") || 6,
    coreTeaching: getSs1BlockNumber("coreTeaching") || 9,
    visualExplanation: getSs1BlockNumber("visualExplanation") || 10,
    workedExample: getSs1BlockNumber("workedExample") || 17,
    examPractice: getSs1BlockNumber("examPractice") || 22,
    summary: getSs1BlockNumber("summary") || 23,
  };

  const lines = [
    "--------------------------------",
    CORE_LEARNING_DISCIPLINE_MARKER,
    "--------------------------------",
    "",
    "MANDATORY — teach with Save My Exams clarity while preserving LetsRevise richness.",
    "This phase is **prompt-only** — do NOT add, remove, or reorder blocks.",
    "",
    "RULE 1 — NO REPEATED DEFINITIONS:",
    "Once a concept is defined, DO NOT redefine it later.",
    "Later sections must **extend**, **apply**, **evaluate**, or **compare** — not repeat the definition.",
    "",
    "Canonical terms (define ONCE only):",
    ...cld.canonicalTerms.map((t) => `- ${t}`),
    "",
    "RULE 2 — EXPLANATION PROGRESSION:",
    "Enforce: **Definition → Mechanism → Application → Evaluation**",
    "Each major section must advance understanding:",
    `- Block ${blocks.definition} — Definition (what it is)`,
    `- Block ${blocks.coreModel} — Core model (structural overview — pathway or sequence)`,
    `- Block ${blocks.coreTeaching} — Mechanism (how it works, because/therefore chains)`,
    `- Block ${blocks.workedExample} — Application (worked scenario or data)`,
    `- Block ${blocks.examPractice} — Evaluation (exam-style analysis)`,
    `- Block ${blocks.summary} — Final takeaways only`,
    "",
    "RULE 3 — DIAGRAM COMPLEMENTARITY:",
    "Diagram captions must NOT repeat nearby paragraph text.",
    "Explain: **what the student should notice**, **what process is shown**, **why it matters**.",
    cld.diagramGuidance ? `Topic diagram guidance: ${cld.diagramGuidance}` : "",
    "",
    "RULE 4 — SUMMARY DISCIPLINE:",
    "Summary must contain **final takeaways** and **examiner conclusions** — NOT repeated lesson content.",
    ...(cld.summaryTakeaways || []).map((t) => `- ${t}`),
    "",
    "RULE 5 — EXAM PRACTICE DISCIPLINE:",
    "Exam practice must test **application**, **analysis**, and **evaluation** — NOT simple recall already covered.",
    `Preferred stems: ${(cld.examPracticeStems || []).join("; ")}`,
    "",
    "FORBIDDEN:",
    ...(cld.forbiddenRepeats || []).map((f) => `- ${f}`),
    "",
    "QUALITY:",
    "- Progress each section one stage forward.",
    "- Use examiner-grade connectives (because, therefore, consequently).",
    "- Preserve Teacher-First, Required Practical, Examiner Language V2, and Grade 8/9 blocks unchanged in structure.",
  ].filter(Boolean);

  return lines.join("\n");
}

function buildCoreLearningDisciplinePromptSection(meta = {}) {
  if (!isCoreLearningDisciplineEnabled()) return "";
  const profile = resolveTeachingQualityProfile(meta);
  if (profile?.coreLearningDiscipline) return buildCoreLearningDisciplineAppendix(profile);
  const { buildSubjectIntelligenceCoreDisciplineFallback } = require("./subjectIntelligenceEngine");
  return buildSubjectIntelligenceCoreDisciplineFallback(meta);
}

function computeDisciplineScore(signals = {}) {
  let score = 100;
  score -= (signals.repeatedDefinitionCount || 0) * 15;
  score -= (signals.mechanismRepeatCount || 0) * 12;
  score -= (signals.summaryOverlapPct || 0) > 50 ? 20 : 0;
  score -= (signals.diagramOverlapPct || 0) > 55 ? 15 : 0;
  score -= signals.examRecallOnly ? 20 : 0;
  score -= signals.progressionHits < signals.progressionTotal ? 10 : 0;
  return Math.max(0, Math.min(100, score));
}

function scoreCoreLearningDiscipline(text = "", profile = null) {
  const cld = profile?.coreLearningDiscipline;
  if (!cld) {
    return { skipped: true, pass: true, disciplineScore: 100, signals: {}, violations: [] };
  }

  const bodies = extractExtendedBlockBodies(text);
  const repeatedDefs = findRepeatedDefinitions(bodies, profile);
  const progression = scoreProgression(bodies, profile);
  const diagram = scoreDiagramComplementarity(bodies);
  const summary = scoreSummaryDiscipline(bodies);
  const exam = scoreExamPracticeDiscipline(bodies);
  const mechanism = scoreMechanismRepetition(bodies);

  const violations = [
    ...repeatedDefs.violations,
    ...progression.violations,
    ...diagram.violations,
    ...summary.violations,
    ...exam.violations,
    ...mechanism.violations,
  ];

  const signals = {
    repeatedDefinitionCount: repeatedDefs.repeatCount,
    mechanismRepeatCount: mechanism.repeatCount,
    progressionHits: progression.hits,
    progressionTotal: progression.total,
    diagramOverlapPct: diagram.overlapPct || 0,
    summaryOverlapPct: summary.overlapPct || 0,
    examRecallOnly: exam.recallOnly || false,
    examApplicationCount: exam.applicationCount || 0,
  };

  const disciplineScore = computeDisciplineScore(signals);

  return {
    skipped: false,
    pass: violations.length === 0,
    disciplineScore,
    signals,
    violations,
  };
}

module.exports = {
  CORE_LEARNING_DISCIPLINE_MARKER,
  isCoreLearningDisciplineEnabled,
  buildCoreLearningDisciplineAppendix,
  buildCoreLearningDisciplinePromptSection,
  scoreCoreLearningDiscipline,
  extractExtendedBlockBodies,
  computeDisciplineScore,
};
