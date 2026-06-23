/**
 * Phase 3H.1.8b.3a — Worked Reasoning V2 (prompt-only + semantic read-only scoring).
 * No HTML requirements. No post-generation mutation.
 */

const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const {
  getSs1BlockNumber,
  isTeacherFirstSs1Enabled,
} = require("./teacherFirstSs1Architecture");
const { isTeachingQualityUpgradeEnabled } = require("./reasoningChainEngine");

const WORKED_REASONING_MARKER = "WORKED REASONING ENGINE (3H.1.8b.3a):";

const CAUSAL_MARKERS =
  /\b(because|therefore|so that|this means that|consequently|as a result|leads to|enables|allows)\b/gi;

function isWorkedReasoningV2Enabled() {
  return (
    isTeachingQualityUpgradeEnabled() &&
    isTeacherFirstSs1Enabled() &&
    String(process.env.TEACHER_BRAIN_WORKED_REASONING_V2 || "0").trim() === "1"
  );
}

function stripHtml(html = "") {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractWorkedExampleBody(lessonText = "") {
  const lines = String(lessonText || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i]) && /\bWORKED\s+EXAMPLE\b/i.test(lines[i])) {
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
  const blockLines = lines.slice(start, end);
  const pasteIdx = blockLines.findIndex((l) => /^Paste into:/i.test(l.trim()));
  const body =
    pasteIdx >= 0 ? blockLines.slice(pasteIdx + 1).join("\n") : blockLines.slice(2).join("\n");
  return body.trim();
}

function resolvePrimaryChain(profile) {
  const wr = profile?.workedReasoning;
  if (!wr?.primaryChainId || !profile?.reasoningChains?.length) return null;
  return profile.reasoningChains.find((c) => c.id === wr.primaryChainId) || null;
}

function resolveSecondaryChain(profile) {
  const wr = profile?.workedReasoning;
  if (!wr?.secondaryChainId || !profile?.reasoningChains?.length) return null;
  return profile.reasoningChains.find((c) => c.id === wr.secondaryChainId) || null;
}

function countSequencedPoints(plain = "") {
  const text = String(plain || "");
  const numbered = (text.match(/(?:^|[\n\r])\s*\d+[\.)]\s+/gm) || []).length;
  const inlineNumbered =
    numbered === 0 ? (text.match(/\b\d+[\.)]\s+/g) || []).length : 0;
  const bullets = (text.match(/(?:^|[\n\r])\s*[•\-\*]\s+/gm) || []).length;
  const causalSentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && CAUSAL_MARKERS.test(s)).length;
  return Math.max(numbered, inlineNumbered, bullets, causalSentences);
}

function labelTokenCoverage(labels = [], hay = "") {
  const tokens = labels.map((l) => String(l).toLowerCase().trim()).filter(Boolean);
  if (!tokens.length) return { ratio: 1, hits: 0, total: 0 };
  let hits = 0;
  for (const label of tokens) {
    if (hay.includes(label)) {
      hits += 1;
      continue;
    }
    const words = label.split(/\s+/).filter((w) => w.length > 3);
    if (words.some((w) => hay.includes(w))) hits += 1;
  }
  return { ratio: hits / tokens.length, hits, total: tokens.length };
}

function chainStepCoverage(chain, hay = "") {
  if (!chain?.steps?.length) return { ratio: 1, hits: 0, total: 0 };
  let hits = 0;
  for (const step of chain.steps) {
    const words = step
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4)
      .slice(0, 3);
    if (words.some((w) => hay.includes(w))) hits += 1;
  }
  return { ratio: hits / chain.steps.length, hits, total: chain.steps.length };
}

function buildWorkedReasoningAppendix(profile) {
  if (!isWorkedReasoningV2Enabled() || !profile?.workedReasoning) return "";

  const wr = profile.workedReasoning;
  const primary = resolvePrimaryChain(profile);
  const secondary = resolveSecondaryChain(profile);
  const coreModelBlock = getSs1BlockNumber("coreModel") || 6;
  const coreTeachingBlock = getSs1BlockNumber("coreTeaching") || 9;
  const workedExampleBlock = getSs1BlockNumber("workedExample") || 17;

  const lines = [
    "--------------------------------",
    WORKED_REASONING_MARKER,
    "--------------------------------",
    "",
    "MANDATORY — stronger worked reasoning (format-agnostic; plain text, bullets, or numbered lines all acceptable):",
    "",
    "Do NOT require HTML tags. Do NOT mandate ordered lists. Teach like a classroom model answer.",
    "",
    "REQUIRED PLACEMENT:",
    `- Block ${coreModelBlock} (CORE MODEL): keep one full arrow or numbered chain (3H.1.8a).`,
    `- Block ${coreTeachingBlock} (CORE TEACHING): add ONE "Explain how…" micro-chain (max 5 steps) that adds mechanism beyond block ${coreModelBlock}.`,
    `- Block ${workedExampleBlock} (WORKED EXAMPLE): full ${wr.minSteps || 4}–6 mark worked answer with explicit causal links.`,
    "",
    "WORKED EXAMPLE CONTENT RULES:",
    `- Start with an exam-style Question stem (${wr.commandWord || "Explain how"} … include mark count).`,
    `- Give ${wr.minSteps || 4}+ linked marking-point sentences using because / therefore / so that / this means that / consequently.`,
    `- Name structures and mechanisms — not vague "messages" or "the body reacts".`,
    `- Model the primary chain: **${primary?.label || wr.primaryChainId}**`,
    "",
  ];

  if (primary?.steps?.length) {
    lines.push("Primary chain to model (adapt wording, keep causal order):");
    primary.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    lines.push("");
  }

  if (secondary?.steps?.length) {
    lines.push(
      `Secondary chain for Core Teaching only (${secondary.label}):`,
      secondary.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      ""
    );
  }

  if (wr.defaultExamStem) {
    lines.push(`Suggested exam stem: ${wr.defaultExamStem}`);
    lines.push("");
  }

  if (wr.markingPointLabels?.length) {
    lines.push("Marking-point themes to cover:");
    wr.markingPointLabels.forEach((l) => lines.push(`- ${l}`));
    lines.push("");
  }

  lines.push(
    "QUALITY RULES:",
    "- Each marking point must **cause or enable** the next.",
    '- Use examiner-style GCSE phrasing: "because", "therefore", "so that", "this means that", "consequently".',
    "- Do not collapse into one vague paragraph.",
    "- Do not change block order or add new blocks."
  );

  return lines.join("\n");
}

function buildWorkedReasoningPromptSection(meta = {}) {
  if (!isWorkedReasoningV2Enabled()) return "";
  const profile = resolveTeachingQualityProfile(meta);
  if (profile?.workedReasoning) return buildWorkedReasoningAppendix(profile);
  const { buildSubjectIntelligenceWorkedReasoningFallback } = require("./subjectIntelligenceEngine");
  return buildSubjectIntelligenceWorkedReasoningFallback(meta);
}

function scoreWorkedReasoningCoverage(text = "", profile = null) {
  const resolved = profile || null;
  const wr = resolved?.workedReasoning;
  if (!wr) {
    return {
      skipped: true,
      pass: true,
      signals: {},
      violations: [],
    };
  }

  const body = extractWorkedExampleBody(text);
  const plain = stripHtml(body).toLowerCase();
  const minSteps = wr.minSteps || 4;

  const hasContent = plain.length >= 60;
  const questionStem =
    /\?/.test(plain) ||
    /\b\d+\s*marks?\b/i.test(plain) ||
    new RegExp(`\\b${String(wr.commandWord || "explain how").replace(/\s+/g, "\\s+")}\\b`, "i").test(
      plain
    ) ||
    /\bquestion\s*:/i.test(body);

  const sequencedPoints = countSequencedPoints(plain);
  const causalMatches = plain.match(CAUSAL_MARKERS) || [];
  const causalCount = causalMatches.length;

  const primary = resolvePrimaryChain(resolved);
  const chainCov = chainStepCoverage(primary, plain);
  const labelCov = labelTokenCoverage(wr.markingPointLabels || [], plain);

  const signals = {
    hasContent,
    questionStem,
    sequencedPoints,
    minSteps,
    causalCount,
    chainCoveragePct: Math.round(chainCov.ratio * 100),
    markingPointCoveragePct: Math.round(labelCov.ratio * 100),
  };

  const violations = [];
  if (!hasContent) violations.push("Worked Example body too thin.");
  if (!questionStem) violations.push("Missing exam-style question stem in Worked Example.");
  if (sequencedPoints < minSteps) {
    violations.push(`Fewer than ${minSteps} sequenced marking points (found ${sequencedPoints}).`);
  }
  if (causalCount < 2) violations.push("Fewer than 2 causal connectors in Worked Example.");
  if (chainCov.ratio < 0.5) violations.push("Primary reasoning chain coverage below 50%.");
  if (labelCov.ratio < 0.5) violations.push("Marking-point theme coverage below 50%.");

  return {
    skipped: false,
    pass: violations.length === 0,
    signals,
    violations,
  };
}

module.exports = {
  WORKED_REASONING_MARKER,
  isWorkedReasoningV2Enabled,
  buildWorkedReasoningAppendix,
  buildWorkedReasoningPromptSection,
  scoreWorkedReasoningCoverage,
  extractWorkedExampleBody,
  stripHtml,
};
