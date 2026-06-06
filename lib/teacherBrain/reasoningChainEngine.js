/**
 * Phase 3H.1.8a — Reasoning chain prompt appendix + read-only detection (no mutation).
 */

const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const {
  getSs1BlockNumber,
  isTeacherFirstSs1Enabled,
} = require("./teacherFirstSs1Architecture");

const REASONING_CHAIN_MARKER = "GCSE REASONING CHAIN ENGINE (3H.1.8a):";

function isTeachingQualityUpgradeEnabled() {
  return String(process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE || "0").trim() === "1";
}

function isReasoningChainEngineEnabled() {
  return isTeachingQualityUpgradeEnabled();
}

function formatChainSteps(steps = []) {
  return steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

function formatChainArrow(steps = []) {
  return steps.join(" → ");
}

function buildReasoningChainAppendix(profile) {
  if (!isReasoningChainEngineEnabled() || !profile?.reasoningChains?.length) {
    return "";
  }

  const coreModelBlock = getSs1BlockNumber("coreModel") || 6;
  const coreTeachingBlock = getSs1BlockNumber("coreTeaching") || 9;
  const workedExampleBlock = getSs1BlockNumber("workedExample") || 20;

  const lines = [
    "--------------------------------",
    REASONING_CHAIN_MARKER,
    "--------------------------------",
    "",
    "MANDATORY — explicit GCSE cause-and-effect reasoning (Teacher-First, flag ON):",
    "",
    "Do NOT stop at naming facts. Every major concept needs a **linked reasoning chain** with clear steps.",
    "",
    "REQUIRED PLACEMENT:",
    `- Block ${coreModelBlock} (CORE MODEL): include at least **one** full chain using **→** or a numbered \`<ol>\` (minimum 5 steps).`,
    `- Block ${coreTeachingBlock} (CORE TEACHING): extend with **Explain how…** modelling — at least one chain showing mechanism → outcome.`,
    `- Block ${workedExampleBlock} (WORKED EXAMPLE): question stem + numbered reasoning steps that earn marking points (use *because / therefore / so that*).`,
    "",
    "CHAIN FORMAT (use this style — adapt to the topic):",
    "  Step A → Step B → Step C → … → final outcome",
    "",
    "TOPIC-SPECIFIC CHAINS TO MODEL (do not copy verbatim — teach in classroom voice):",
    "",
  ];

  for (const chain of profile.reasoningChains) {
    lines.push(`**${chain.label}**`);
    lines.push(formatChainArrow(chain.steps));
    lines.push("");
    lines.push("Numbered version:");
    lines.push(formatChainSteps(chain.steps));
    if (chain.examPrompt) {
      lines.push(`Exam-style stem: ${chain.examPrompt}`);
    }
    lines.push("");
  }

  lines.push(
    "QUALITY RULES:",
    "- Each step must **cause or enable** the next — not a bullet list of unrelated facts.",
    '- Include at least **two** complete chains across Core Model + Core Teaching + Worked Example.',
    '- Prefer "Explain how…" over "Describe what…" in worked reasoning.',
    "- Do not collapse chains into one vague sentence."
  );

  return lines.join("\n");
}

function buildReasoningChainPromptSection(meta = {}) {
  if (!isReasoningChainEngineEnabled() || !isTeacherFirstSs1Enabled()) return "";
  const profile = resolveTeachingQualityProfile(meta);
  return buildReasoningChainAppendix(profile);
}

const CAUSAL_MARKERS =
  /\b(because|therefore|so that|this means|as a result|leads to|causes|enables|allows|detect|activat|return|towards|optimum)\b/i;

function scoreReasoningChainCoverage(text = "", profile = null) {
  const plain = String(text || "");
  const hay = plain.toLowerCase();

  const arrowChainMatches = (plain.match(/(?:→|->|\u2192)/g) || []).length;
  const numberedSteps = (plain.match(/(?:^|\n)\s*(?:\d+[\.)]\s+|Step\s+\d+\s*:)/gim) || []).length;
  const causalHits = (plain.match(CAUSAL_MARKERS) || []).length;

  let profileTokenHits = 0;
  let profileTokensTotal = 0;
  if (profile) {
    for (const chain of profile.reasoningChains) {
      for (const step of chain.steps) {
        profileTokensTotal += 1;
        const tokens = step
          .toLowerCase()
          .split(/\W+/)
          .filter((t) => t.length > 4)
          .slice(0, 3);
        if (tokens.some((t) => hay.includes(t))) profileTokenHits += 1;
      }
    }
  }

  const hasLongChain =
    arrowChainMatches >= 4 ||
    numberedSteps >= 5 ||
    (causalHits >= 4 && plain.length > 800);

  const profileCoveragePct =
    profileTokensTotal > 0 ? Math.round((profileTokenHits / profileTokensTotal) * 100) : null;

  return {
    arrowChainMatches,
    numberedSteps,
    causalMarkerCount: causalHits,
    profileCoveragePct,
    hasExplicitChain: hasLongChain || (profileCoveragePct !== null && profileCoveragePct >= 35),
    pass: hasLongChain && causalHits >= 2,
  };
}

module.exports = {
  REASONING_CHAIN_MARKER,
  isTeachingQualityUpgradeEnabled,
  isReasoningChainEngineEnabled,
  buildReasoningChainAppendix,
  buildReasoningChainPromptSection,
  scoreReasoningChainCoverage,
};
