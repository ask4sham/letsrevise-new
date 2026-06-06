/**
 * Phase 3H.1.8a — Examiner language prompt appendix + read-only detection (no mutation).
 */

const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const {
  getSs1BlockNumber,
  isTeacherFirstSs1Enabled,
} = require("./teacherFirstSs1Architecture");
const { isTeachingQualityUpgradeEnabled } = require("./reasoningChainEngine");

const EXAMINER_LANGUAGE_MARKER = "EXAMINER LANGUAGE ENGINE (3H.1.8a):";

function isExaminerLanguageEngineEnabled() {
  return isTeachingQualityUpgradeEnabled();
}

const EXAMINER_PHRASE_PATTERNS = [
  { key: "studentsOftenWrite", rx: /students?\s+often\s+write/i },
  { key: "examinersExpect", rx: /examiners?\s+expect/i },
  { key: "useThePhrase", rx: /use\s+the\s+phrase/i },
  { key: "avoidSaying", rx: /avoid\s+saying|do\s+not\s+(?:just\s+)?say/i },
  { key: "aqaWording", rx: /aqa\s+wording|mark[- ]scheme|command\s+word/i },
  { key: "markLosing", rx: /mark[- ]losing|loses?\s+marks?|weak\s+answer/i },
  { key: "thinkLikeExaminer", rx: /think\s+like\s+an\s+examiner|in\s+the\s+exam,?\s+say/i },
  { key: "premiumExamTip", rx: /premium\s+exam\s+tip|🎯\s*premium\s+exam\s+tip/i },
  { key: "weakBetterFull", rx: /weak\s+answer\s*:|better\s+answer\s*:|full[- ]mark\s+answer\s*:/i },
];

function formatExaminerExamples(spec, blocks) {
  return [
    `**Students often write:** ${spec.studentsOftenWrite}`,
    `**Examiners expect:** ${spec.examinersExpect}`,
    `**Use the phrase:** ${spec.useThePhrase}`,
    `**Avoid saying:** ${spec.avoidSaying}`,
    `**AQA wording:** ${spec.aqaWording}`,
    `**Common mark-losing phrase:** ${spec.markLosingPhrase}`,
    "",
    "Place examiner-aware lines in these blocks:",
    `- Block ${blocks.coreTeaching} (CORE TEACHING): at least one "In the exam, say…" or "Examiners expect…" line.`,
    `- Block ${blocks.commonMistake} (COMMON MISTAKE): Wrong vs Correct with **Exam link:** explaining mark loss.`,
    `- Block ${blocks.examTip} (EXAM TIP): command word + what examiners credit + mark-losing wording to avoid.`,
    `- Block ${blocks.workedExample} (WORKED EXAMPLE): show how phrasing earns marks (not just the correct fact).`,
  ].join("\n");
}

function buildExaminerLanguageAppendix(profile) {
  if (!isExaminerLanguageEngineEnabled() || !profile?.examinerLanguage) {
    return "";
  }

  const blocks = {
    coreTeaching: getSs1BlockNumber("coreTeaching") || 9,
    commonMistake: getSs1BlockNumber("commonMistake") || 15,
    examTip: getSs1BlockNumber("examTip") || 19,
    workedExample: getSs1BlockNumber("workedExample") || 20,
  };

  const lines = [
    "--------------------------------",
    EXAMINER_LANGUAGE_MARKER,
    "--------------------------------",
    "",
    "MANDATORY — teach how **examiners think**, not only the science:",
    "",
    "Include **at least four** of these examiner-framing patterns somewhere in Core Teaching, Common Mistake, Exam Tip, or Worked Example:",
    '- "Students often write…"',
    '- "Examiners expect…"',
    '- "Use the phrase…"',
    '- "Avoid saying…"',
    '- "AQA wording…" / mark-scheme language',
    '- "Common mark-losing phrase…"',
    "",
    "TOPIC-SPECIFIC EXAMINER GUIDANCE (adapt — do not paste as one block of quotes):",
    "",
    formatExaminerExamples(profile.examinerLanguage, blocks),
    "",
    "QUALITY RULES:",
    "- Examiner language must be **topic-specific** — not generic revision advice.",
    "- Pair every weak phrasing with a **stronger exam line**.",
    "- Common Mistake block must explain **why** marks are lost, not only that the answer is wrong.",
  ];

  return lines.join("\n");
}

function buildExaminerLanguagePromptSection(meta = {}) {
  if (!isExaminerLanguageEngineEnabled() || !isTeacherFirstSs1Enabled()) return "";
  const profile = resolveTeachingQualityProfile(meta);
  return buildExaminerLanguageAppendix(profile);
}

function extractBlockBody(text, titleRx) {
  const chunks = String(text || "").split(/\n(?=\d+\s*[—\-–]\s+)/);
  for (const chunk of chunks) {
    const header = chunk.match(/^\d+\s*[—\-–]\s+([^\n]+)/);
    if (!header || !titleRx.test(header[1])) continue;
    return chunk.replace(/^[^\n]+\n(?:Paste into:[^\n]+\n)?/i, "").trim();
  }
  return "";
}

function scoreExaminerLanguageCoverage(text = "") {
  const full = String(text || "");
  const hits = {};
  let distinctPatterns = 0;

  for (const { key, rx } of EXAMINER_PHRASE_PATTERNS) {
    const found = rx.test(full);
    hits[key] = found;
    if (found) distinctPatterns += 1;
  }

  const targetBlocks = {
    coreTeaching: /core\s+teaching/i.test(full)
      ? extractBlockBody(full, /core\s+teaching/i)
      : "",
    commonMistake: extractBlockBody(full, /common\s+mistake/i),
    examTip: extractBlockBody(full, /exam\s+tip/i),
    workedExample: extractBlockBody(full, /worked\s+example/i),
  };

  const blocksWithExaminerLanguage = Object.values(targetBlocks).filter((body) =>
    EXAMINER_PHRASE_PATTERNS.some(({ rx }) => rx.test(body))
  ).length;

  return {
    patternHits: hits,
    distinctPatterns,
    blocksWithExaminerLanguage,
    pass: distinctPatterns >= 3 && blocksWithExaminerLanguage >= 2,
  };
}

module.exports = {
  EXAMINER_LANGUAGE_MARKER,
  isExaminerLanguageEngineEnabled,
  buildExaminerLanguageAppendix,
  buildExaminerLanguagePromptSection,
  scoreExaminerLanguageCoverage,
};
