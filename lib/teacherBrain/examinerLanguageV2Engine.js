/**
 * Phase 3H.1.8b.3b — Examiner Language V2 (prompt-only + read-only scoring).
 * Upgrades wording quality in four teaching blocks only — no structure mutation.
 */

const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const {
  getSs1BlockNumber,
  isTeacherFirstSs1Enabled,
} = require("./teacherFirstSs1Architecture");
const { isTeachingQualityUpgradeEnabled } = require("./reasoningChainEngine");
const { stripHtml } = require("./workedReasoningEngine");

const EXAMINER_LANGUAGE_V2_MARKER = "EXAMINER LANGUAGE V2 (3H.1.8b.3b):";

/** Only these four blocks may receive examiner-language V2 guidance or scoring. */
const V2_TARGET_BLOCK_KEYS = [
  "coreTeaching",
  "commonMistake",
  "examTechnique",
  "workedExample",
];

const EXAMINER_CONNECTIVES =
  /\b(because|therefore|thus|as a result|leading to|resulting in|consequently|so that|this means that|indicating|indicates)\b/gi;

const SCIENTIFIC_VERBS =
  /\b(provides|enables|results in|causes|stimulates|transmits?|transmitted|coordinates?|coordinated|regulates?|controls?|increases?|decreases?|activates?|detects?|detected|releases?|maintains?|produces?|removes?|returns?|refracts?|converges?|evaporates?)\b/gi;

const VAGUE_VERBS = /\b(needs?|helps?|makes?|uses?|gets?|does)\b/gi;

const VAGUE_NOUNS = /\b(signals?|messages?)\b/gi;

const SCIENTIFIC_NOUNS =
  /\b(electrical impulses?|neural transmission|neurones?|receptors?|effectors?|coordination centre|hypothalamus|synapses?|thermoreceptors?|chloroplasts?|enzymes?|diffusion gradients?|stimulus|accommodation|retina|cornea)\b/gi;

const EXAMINER_FRAMING =
  /\b(students often write|examiners expect|do not say|creditworthy answer|to gain full marks|a common reason marks are lost|weak:|correct:|full[- ]mark)\b/gi;

const PROTECTED_BLOCK_KEYS = new Set([
  "objectives",
  "priorKnowledge",
  "definition",
  "scenario",
  "whyItMatters",
  "coreModel",
  "keyExamples",
  "examVocabulary",
  "checkpoint",
  "summary",
  "keywords",
  "examPractice",
  "equipment",
  "method",
  "variables",
  "variablesMatch",
]);

const TARGET_BLOCK_TITLE_PATTERNS = [
  { key: "coreTeaching", rx: /core\s+teaching|core\s+learning/i },
  { key: "commonMistake", rx: /common\s+mistake/i },
  { key: "examTechnique", rx: /exam\s+technique/i },
  { key: "workedExample", rx: /worked\s+example/i },
];

function isExaminerLanguageV2Enabled() {
  return (
    isTeachingQualityUpgradeEnabled() &&
    isTeacherFirstSs1Enabled() &&
    String(process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 || "0").trim() === "1"
  );
}

function extractBlockBodiesByPatterns(text = "") {
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
    const match = TARGET_BLOCK_TITLE_PATTERNS.find((p) => p.rx.test(title));
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

function pickTargetBodies(bodies = {}) {
  const out = {};
  for (const key of V2_TARGET_BLOCK_KEYS) {
    if (bodies[key]) out[key] = bodies[key];
  }
  return out;
}

function tokenizeHay(bodies = {}) {
  return Object.values(pickTargetBodies(bodies))
    .map((b) => stripHtml(b).toLowerCase())
    .filter(Boolean)
    .join("\n");
}

function countMatches(rx, hay = "") {
  const flags = rx.flags.includes("g") ? rx : new RegExp(rx.source, `${rx.flags}g`);
  return (hay.match(flags) || []).length;
}

function contrastPairCoverage(pairs = [], hay = "") {
  let matched = 0;
  const details = [];
  for (const pair of pairs) {
    const weak = String(pair.weak || "").toLowerCase();
    const strong = String(pair.strong || "").toLowerCase();
    const strongWords = strong.split(/\W+/).filter((w) => w.length > 4);
    const strongHit =
      hay.includes(strong) || strongWords.filter((w) => hay.includes(w)).length >= 2;
    const weakHit = weak && hay.includes(weak);
    if (strongHit) matched += 1;
    details.push({ weak, strong, strongHit, weakHit });
  }
  return { matched, total: pairs.length, details };
}

function modelAnswerStructureScore(plain = "") {
  const observation =
    /\b(mean|reading|data|decreased|increased|rose|fell|ms|cm|°c|trial|result)\b/i.test(plain);
  const evidence = /\b(evidence|data|result|reading|shows?|indicates?)\b/i.test(plain);
  const mechanism =
    /\b(because|acts|transmission|transmits|coordinates|mechanism|stimulant|impulses?)\b/i.test(
      plain
    );
  const conclusion = /\b(therefore|thus|consequently|supports|conclusion|indicates)\b/i.test(
    plain
  );
  const steps =
    (plain.match(/(?:^|[\n\r])\s*(?:step\s*)?[1-4][\.)]/gim) || []).length +
    (plain.match(/\bstep\s*[1-4]\b/gi) || []).length;
  const hits = [observation, evidence, mechanism, conclusion].filter(Boolean).length;
  return { observation, evidence, mechanism, conclusion, steps, hits };
}

function appendFramingLines(lines, v2) {
  if (v2.studentsOftenWrite) {
    lines.push(`Students often write: ${v2.studentsOftenWrite}`);
  }
  if (v2.examinersExpect) {
    lines.push(`Examiners expect: ${v2.examinersExpect}`);
  }
  if (v2.doNotSay) {
    lines.push(`Do not say: ${v2.doNotSay}`);
  }
  if (v2.creditworthyAnswer) {
    lines.push(`Creditworthy answer: ${v2.creditworthyAnswer}`);
  }
  if (v2.fullMarksGuidance) {
    lines.push(`To gain full marks: ${v2.fullMarksGuidance}`);
  }
  if (v2.markLosingReason) {
    lines.push(`A common reason marks are lost is: ${v2.markLosingReason}`);
  }
}

function buildExaminerLanguageV2Appendix(profile) {
  if (!isExaminerLanguageV2Enabled() || !profile?.examinerLanguageV2) return "";

  const v2 = profile.examinerLanguageV2;
  const blocks = {
    coreTeaching: getSs1BlockNumber("coreTeaching") || 9,
    commonMistake: getSs1BlockNumber("commonMistake") || 15,
    examTechnique: getSs1BlockNumber("examTechnique") || 16,
    workedExample: getSs1BlockNumber("workedExample") || 17,
  };

  const lines = [
    "--------------------------------",
    EXAMINER_LANGUAGE_V2_MARKER,
    "--------------------------------",
    "",
    "MANDATORY — upgrade wording from student-friendly to **examiner-grade** (readable GCSE level).",
    "This phase changes **language quality only** in FOUR blocks — do NOT add, remove, or reorder blocks.",
    "",
    "DO NOT rewrite these blocks (protected — leave wording unchanged):",
    "- Revision Objectives, Prior Knowledge, Definition, Scenario, Why It Matters",
    "- Core Model, Key Examples, Exam Vocabulary, Checkpoint, Drag & Drop, Step-by-Step Process",
    "- Summary, Key Words, Exam Practice, Quiz / Revision Check",
    "- Required Practical Equipment lists or Method steps (if present)",
    "",
    "APPLY examiner-grade language ONLY in:",
    `- Block ${blocks.coreTeaching} (CORE TEACHING / CORE LEARNING)`,
    `- Block ${blocks.commonMistake} (COMMON MISTAKE)`,
    `- Block ${blocks.examTechnique} (EXAM TECHNIQUE)`,
    `- Block ${blocks.workedExample} (WORKED EXAMPLE + model answers)`,
    "",
    "EXAMINER FRAMING — use these patterns where appropriate:",
    '- "Students often write…" then show a weak line and a stronger replacement.',
    '- "Examiners expect…" with named GCSE terms and cause → effect.',
    '- "Do not say…" / "Say this instead…"',
    '- "Creditworthy answer…" / "To gain full marks…"',
    '- "A common reason marks are lost is…"',
    "",
    "RULE 1 — Replace vague verbs (need, help, make, use, get, do) with scientific verbs:",
    "provides, enables, results in, causes, stimulates, transmits, coordinates, regulates, controls.",
    "",
    "RULE 2 — Prefer cause → effect chains with explicit mechanisms.",
    'Weak: "Plants need light."',
    'Strong: "Light provides the energy required for photosynthesis."',
    'Weak: "Messages travel through nerves."',
    'Strong: "Electrical impulses travel along neurones."',
    "",
    "RULE 3 — Prefer topic-specific GCSE nouns over vague wording:",
    "stimulus, receptor, effector, chloroplast, enzyme, active transport, diffusion gradient,",
    "electrical impulse, synapse, thermoreceptor, accommodation, retina — as appropriate to the topic.",
    "",
    "RULE 4 — Use examiner connectives: because, therefore, thus, as a result, leading to, resulting in, consequently.",
    "",
    "RULE 5 — Worked Example model answers must show:",
    "Observation → Evidence → Mechanism → Conclusion (Step 1–4 or four linked sentences).",
    "",
    "TOPIC-SPECIFIC EXAMINER LANGUAGE V2 (adapt — do not paste as one block):",
    "",
  ];

  appendFramingLines(lines, v2);
  if (
    v2.studentsOftenWrite ||
    v2.examinersExpect ||
    v2.doNotSay ||
    v2.creditworthyAnswer ||
    v2.fullMarksGuidance ||
    v2.markLosingReason
  ) {
    lines.push("");
  }

  if (v2.gcseTerms?.length) {
    lines.push("GCSE terminology to prefer in target blocks:");
    v2.gcseTerms.forEach((term) => lines.push(`- ${term}`));
    lines.push("");
  }

  if (v2.examSayLines?.length) {
    lines.push("In-the-exam phrasing to model (Core Learning or Exam Technique):");
    v2.examSayLines.forEach((line) => lines.push(`- ${line}`));
    lines.push("");
  }

  if (v2.contrastPairs?.length) {
    lines.push("Weak → Strong contrast pairs (Common Mistake, Exam Technique, or Worked Example):");
    v2.contrastPairs.forEach((pair) => {
      lines.push(`- Weak: ${pair.weak}`);
      lines.push(`  Strong: ${pair.strong}`);
    });
    lines.push("");
  }

  if (v2.modelAnswerExample) {
    lines.push("Worked Example model answer pattern (Observation → Evidence → Mechanism → Conclusion):");
    lines.push(v2.modelAnswerExample);
    lines.push("");
  }

  lines.push(
    "ANTI-DUPLICATION:",
    "- Do NOT repeat the same examiner sentence across Core Learning, Common Mistake, Exam Technique, and Worked Example.",
    "- Each target block must add **new** examiner value.",
    "- Keep sentences readable to GCSE students — precise, not verbose.",
    "- Do NOT modify Summary, Exam Practice, or any protected block."
  );

  return lines.join("\n");
}

function buildExaminerLanguageV2PromptSection(meta = {}) {
  if (!isExaminerLanguageV2Enabled()) return "";
  const profile = resolveTeachingQualityProfile(meta);
  if (!profile?.examinerLanguageV2) return "";
  return buildExaminerLanguageV2Appendix(profile);
}

function scoreExaminerLanguageV2Coverage(text = "", profile = null) {
  const resolved = profile || null;
  const v2 = resolved?.examinerLanguageV2;
  if (!v2) {
    return { skipped: true, pass: true, signals: {}, violations: [] };
  }

  const bodies = pickTargetBodies(extractBlockBodiesByPatterns(text));
  const hay = tokenizeHay(bodies);
  const violations = [];

  const connectiveCount = countMatches(EXAMINER_CONNECTIVES, hay);
  const scientificVerbCount = countMatches(SCIENTIFIC_VERBS, hay);
  const vagueVerbCount = countMatches(VAGUE_VERBS, hay);
  const vagueNounCount = countMatches(VAGUE_NOUNS, hay);
  const scientificNounCount = countMatches(SCIENTIFIC_NOUNS, hay);
  const examinerFramingCount = countMatches(EXAMINER_FRAMING, hay);

  const contrast = contrastPairCoverage(v2.contrastPairs || [], hay);
  const examSayHits = (v2.examSayLines || []).filter((line) => {
    const tokens = String(line)
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 5)
      .slice(0, 4);
    return tokens.filter((t) => hay.includes(t)).length >= 2;
  }).length;

  const workedPlain = stripHtml(bodies.workedExample || "").toLowerCase();
  const modelStructure = modelAnswerStructureScore(workedPlain);

  const blocksWithGradeLanguage = Object.entries(bodies).filter(([, body]) => {
    const plain = stripHtml(body).toLowerCase();
    return (
      countMatches(SCIENTIFIC_VERBS, plain) >= 1 ||
      countMatches(EXAMINER_CONNECTIVES, plain) >= 1 ||
      countMatches(SCIENTIFIC_NOUNS, plain) >= 1
    );
  }).length;

  const signals = {
    targetBlockCount: Object.keys(bodies).length,
    connectiveCount,
    scientificVerbCount,
    vagueVerbCount,
    vagueNounCount,
    scientificNounCount,
    examinerFramingCount,
    contrastPairsMatched: contrast.matched,
    examSayHits,
    modelStructureHits: modelStructure.hits,
    blocksWithGradeLanguage,
  };

  if (connectiveCount < 2) violations.push("Fewer than 2 examiner connectives in target blocks.");
  if (scientificVerbCount < 2) violations.push("Fewer than 2 scientific verbs in target blocks.");
  if (contrast.matched < 1 && examSayHits < 1) {
    violations.push("No topic-specific contrast pair or exam-say phrasing detected.");
  }
  if (blocksWithGradeLanguage < 2) {
    violations.push("Examiner-grade language in fewer than 2 target blocks.");
  }
  if (bodies.workedExample && modelStructure.hits < 3) {
    violations.push("Worked Example missing Observation/Evidence/Mechanism/Conclusion pattern.");
  }
  if (vagueNounCount > 0 && scientificNounCount === 0) {
    violations.push('Vague nouns ("signals/messages") without scientific alternatives.');
  }

  return {
    skipped: false,
    pass: violations.length === 0,
    signals,
    violations,
    protectedBlocksUntouched: PROTECTED_BLOCK_KEYS,
    targetBlocksOnly: V2_TARGET_BLOCK_KEYS,
  };
}

module.exports = {
  EXAMINER_LANGUAGE_V2_MARKER,
  V2_TARGET_BLOCK_KEYS,
  isExaminerLanguageV2Enabled,
  buildExaminerLanguageV2Appendix,
  buildExaminerLanguageV2PromptSection,
  scoreExaminerLanguageV2Coverage,
  extractBlockBodiesByPatterns,
  pickTargetBodies,
};
