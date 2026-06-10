/**
 * Phase 3H.1.8b.3c — Grade 8/9 Challenge (prompt-only + read-only scoring).
 * Increases analysis, evaluation, justification — no structure mutation.
 */

const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const {
  getSs1BlockNumber,
  isTeacherFirstSs1Enabled,
} = require("./teacherFirstSs1Architecture");
const { isTeachingQualityUpgradeEnabled } = require("./reasoningChainEngine");
const { stripHtml } = require("./workedReasoningEngine");

const GRADE89_CHALLENGE_MARKER = "GRADE 8/9 CHALLENGE (3H.1.8b.3c):";

const CHALLENGE_HEADING_RX =
  /grade\s*8\s*\/\s*9|grade\s*8|grade\s*9|higher\s*tier\s*challenge|top[\s-]?band\s*challenge/i;

const CHALLENGE_COMMAND_RX =
  /\b(compare|contrast|evaluate|justify|explain\s+how|analyse|analyze|assess|to\s+what\s+extent|which\s+is\s+more|evidence[\s-]?based)\b/i;

const RECALL_ONLY_RX =
  /\b(state\s+the\s+function|name\s+the|list\s+the|define\s+the|what\s+is\s+a)\b/i;

const TARGET_BLOCK_PATTERNS = [
  { key: "coreTeaching", rx: /core\s+teaching|core\s+learning/i },
  { key: "workedExample", rx: /worked\s+example/i },
  { key: "examPractice", rx: /exam\s+practice/i },
  { key: "summary", rx: /^summary$/i },
  { key: "coreModel", rx: /core\s+model|core\s+rule/i },
];

function isGrade89ChallengeEnabled() {
  return (
    isTeachingQualityUpgradeEnabled() &&
    isTeacherFirstSs1Enabled() &&
    String(process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1 || "0").trim() === "1"
  );
}

function extractBlockBodies(text = "") {
  const lines = String(text || "").split("\n");
  const bodies = {};
  let i = 0;
  while (i < lines.length) {
    const header = lines[i].match(/^(\d+)\s*[—\-–]\s+(.+)$/i);
    if (!header) {
      i += 1;
      continue;
    }
    const title = header[2].trim();
    const match = TARGET_BLOCK_PATTERNS.find((p) => p.rx.test(title));
    if (match) {
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

function criteriaCoverage(criteria = [], hay = "") {
  let hits = 0;
  for (const criterion of criteria) {
    const words = String(criterion)
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4);
    if (words.filter((w) => hay.includes(w)).length >= Math.min(2, words.length)) {
      hits += 1;
    }
  }
  return { hits, total: criteria.length };
}

function blockHasChallengeContent(body = "") {
  const plain = stripHtml(body);
  return CHALLENGE_HEADING_RX.test(plain) || CHALLENGE_COMMAND_RX.test(plain);
}

function buildGrade89ChallengeAppendix(profile) {
  if (!isGrade89ChallengeEnabled() || !profile?.grade89Challenge) return "";

  const g = profile.grade89Challenge;
  const blocks = {
    coreTeaching: getSs1BlockNumber("coreTeaching") || 9,
    workedExample: getSs1BlockNumber("workedExample") || 17,
    examPractice: getSs1BlockNumber("examPractice") || 22,
    summary: getSs1BlockNumber("summary") || 23,
    coreModel: getSs1BlockNumber("coreModel") || 6,
  };

  const lines = [
    "--------------------------------",
    GRADE89_CHALLENGE_MARKER,
    "--------------------------------",
    "",
    "MANDATORY — add **Grade 8/9 Challenge** stretch content (prompt-only; no new blocks).",
    "This phase increases analysis, evaluation, justification, and comparison — **without changing block order**.",
    "",
    "PLACE one Grade 8/9 Challenge section in **at least two** of these blocks:",
    `- Block ${blocks.coreTeaching} (CORE TEACHING) — preferred: final subsection titled **Grade 8/9 challenge** (≤120 words)`,
    `- Block ${blocks.workedExample} (WORKED EXAMPLE) — top-band comparison or evaluation stem`,
    `- Block ${blocks.examPractice} (EXAM PRACTICE) — one 4–6 mark evaluate/compare question`,
    `- Block ${blocks.summary} (SUMMARY) — one higher-tier application or comparison takeaway`,
    "",
    "CHALLENGE RULES:",
    "1. Require **comparison, evaluation, justification, or evidence-based conclusions** — not simple recall.",
    '2. Bad: "State the function of a sensory neurone."',
    '3. Good: "Compare the roles of sensory, relay and motor neurones in producing a coordinated response."',
    '4. Bad: "Suggest an improvement."',
    '5. Good: "Explain how your improvement would increase reliability, validity or accuracy."',
    "6. Use examiner-grade language from Examiner Language V2 (because, therefore, consequently).",
    "7. Do NOT repeat block " + blocks.coreModel + " (Core Model) pathway verbatim — add new HT depth.",
    "",
    "TOPIC-SPECIFIC GRADE 8/9 CHALLENGE:",
    "",
    `Primary challenge stem: ${g.promptStem}`,
    "",
  ];

  if (g.workedExampleStem) {
    lines.push(`Worked Example challenge: ${g.workedExampleStem}`, "");
  }
  if (g.examPracticeStem) {
    lines.push(`Exam Practice challenge: ${g.examPracticeStem}`, "");
  }
  if (g.summaryStem) {
    lines.push(`Summary challenge line: ${g.summaryStem}`, "");
  }
  if (g.topBandCriteria?.length) {
    lines.push("Top-band criteria to address:");
    g.topBandCriteria.forEach((c) => lines.push(`- ${c}`));
    lines.push("");
  }
  if (g.forbidden) {
    lines.push(`FORBIDDEN: ${g.forbidden}`, "");
  }

  lines.push(
    "QUALITY:",
    "- ≤120 words per Grade 8/9 subsection.",
    "- Must use compare / evaluate / justify / explain command words.",
    "- Evidence-based conclusions required where data or mechanisms are discussed."
  );

  return lines.join("\n");
}

function buildGrade89ChallengePromptSection(meta = {}) {
  if (!isGrade89ChallengeEnabled()) return "";
  const profile = resolveTeachingQualityProfile(meta);
  if (!profile?.grade89Challenge) return "";
  return buildGrade89ChallengeAppendix(profile);
}

function scoreGrade89ChallengeCoverage(text = "", profile = null) {
  const g = profile?.grade89Challenge;
  if (!g) {
    return { skipped: true, pass: true, signals: {}, violations: [] };
  }

  const bodies = extractBlockBodies(text);
  const challengeBlocks = ["coreTeaching", "workedExample", "examPractice", "summary"]
    .filter((key) => bodies[key] && blockHasChallengeContent(bodies[key]))
    .map((key) => ({
      key,
      plain: stripHtml(bodies[key]).toLowerCase(),
    }));

  const combinedHay = challengeBlocks.map((b) => b.plain).join("\n");
  const fullHay = Object.values(bodies)
    .map((b) => stripHtml(b).toLowerCase())
    .join("\n");

  const violations = [];
  const hasHeading = CHALLENGE_HEADING_RX.test(fullHay);
  const commandCount = (fullHay.match(CHALLENGE_COMMAND_RX) || []).length;
  const criteria = criteriaCoverage(g.topBandCriteria || [], combinedHay || fullHay);
  const coreOverlap = jaccardSimilarity(bodies.coreTeaching || "", bodies.coreModel || "");
  const recallOnly = RECALL_ONLY_RX.test(combinedHay) && commandCount < 2;

  const signals = {
    challengeBlockCount: challengeBlocks.length,
    hasHeading,
    commandCount,
    criteriaHits: criteria.hits,
    coreModelOverlapPct: Math.round(coreOverlap * 100),
    recallOnly,
  };

  if (challengeBlocks.length < 1 && !hasHeading) {
    violations.push("No Grade 8/9 challenge content in target blocks.");
  }
  if (commandCount < 2) {
    violations.push("Fewer than 2 challenge command words (compare/evaluate/justify/explain).");
  }
  if (criteria.hits < 2) {
    violations.push("Fewer than 2 top-band criteria addressed.");
  }
  if (coreOverlap > 0.6) {
    violations.push("Core Teaching challenge overlaps Core Model by more than 60%.");
  }
  if (recallOnly) {
    violations.push("Challenge uses recall-only stems without evaluation or comparison.");
  }

  return {
    skipped: false,
    pass: violations.length === 0,
    signals,
    violations,
  };
}

module.exports = {
  GRADE89_CHALLENGE_MARKER,
  isGrade89ChallengeEnabled,
  buildGrade89ChallengeAppendix,
  buildGrade89ChallengePromptSection,
  scoreGrade89ChallengeCoverage,
  extractBlockBodies,
};
