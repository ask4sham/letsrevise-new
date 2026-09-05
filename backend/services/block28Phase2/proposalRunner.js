/**
 * Block 28 Phase 2 — AI mark-scheme proposal runner (local output only, no DB writes).
 */
const { REPAIR_CLASS } = require("./constants");
const { evaluateQualityGates } = require("./qualityGates");
const { normalizeMarkSchemeLines } = require("../../../lib/block28PracticePolicy");

const PROPOSAL_SYSTEM = `You generate UK GCSE/IGCSE exam mark schemes for short-answer questions.

Reply with ONLY JSON:
{"proposedMarkScheme":["point1","point2"],"pointRationales":["why 1 mark","..."],"confidence":0.0,"uncertaintyFlags":[]}

Rules:
- Generate exactly N distinct, substantive, independently awardable one-mark marking points for an N-mark question.
- Do NOT change the question stem.
- Do NOT change the marks value.
- No duplicate points.
- No combined multi-mark bullets.
- Alternatives within one mark point use / or or.
- Scientifically accurate; board-appropriate terminology.
- No invented out-of-scope facts.
- Use MAY/CAN where biological outcome is not certain.`;

function buildProposalUserPrompt(master) {
  const marks = Number(master.marks);
  const scheme = normalizeMarkSchemeLines(master.markSchemeRaw || master.markSchemeNormalized || []);
  return `Generate exactly ${marks} distinct, substantive, independently awardable one-mark marking points for this ${marks}-mark question.

Subject: ${master.subject || "Biology"}
Exam board: ${master.board || "unspecified"}
Level: ${master.level || "GCSE"}
Topic: ${master.topicKey || master.canonicalTopicKey || "unspecified"}

Question (DO NOT CHANGE):
${master.question}

Marks (DO NOT CHANGE): ${marks}

Existing markScheme (reference only):
${JSON.stringify(scheme)}`;
}

function parseProposalResponse(raw) {
  const candidate = raw?.proposedMarkScheme ? raw : raw?.proposal ? raw.proposal : raw;
  return {
    proposedMarkScheme: normalizeMarkSchemeLines(candidate?.proposedMarkScheme || []),
    pointRationales: Array.isArray(candidate?.pointRationales)
      ? candidate.pointRationales.map((r) => String(r))
      : [],
    confidence: typeof candidate?.confidence === "number" ? candidate.confidence : null,
    uncertaintyFlags: Array.isArray(candidate?.uncertaintyFlags)
      ? candidate.uncertaintyFlags.map((f) => String(f))
      : [],
    question: candidate?.question,
    marks: candidate?.marks,
  };
}

/**
 * Run proposal with at most ONE corrective retry (Phase 1 philosophy).
 * @param {object} master
 * @param {object} opts
 * @param {Function} opts.generate - async (system, user) => raw JSON
 * @param {boolean} [opts.allowRetry=true]
 */
async function runMarkSchemeProposal(master, opts = {}) {
  const { generate, allowRetry = true } = opts;
  if (!generate) {
    throw new Error("generate function required for proposal runner");
  }

  if (master.repairClassification !== REPAIR_CLASS.REGENERATE_MARK_SCHEME) {
    return {
      attempted: false,
      reason: "not_regenerate_class",
      approvalStatus: "pending",
    };
  }

  const system = PROPOSAL_SYSTEM;
  let userPrompt = buildProposalUserPrompt(master);

  let attempt = 0;
  let lastRaw = null;
  let lastParsed = null;
  let lastGates = null;

  while (attempt < (allowRetry ? 2 : 1)) {
    attempt += 1;
    const raw = await generate({ system, user: userPrompt, attempt, master });
    lastRaw = raw;
    const parsed = parseProposalResponse(raw);
    const rawMarks = raw?.marks;
    const rawQuestion = raw?.question;
    lastParsed = {
      ...parsed,
      question: master.question,
      marks: master.marks,
      _rawMarks: rawMarks,
      _rawQuestion: rawQuestion,
    };
    lastGates = evaluateQualityGates(master, lastParsed);

    if (lastGates.deterministicPass) {
      return {
        attempted: true,
        attemptCount: attempt,
        retried: attempt > 1,
        proposal: lastParsed,
        qualityGates: lastGates,
        proposalStatus: lastGates.needsReview ? "needs_review" : "structurally_valid",
        approvalStatus: "pending",
        raw: lastRaw,
      };
    }

    if (attempt === 1 && allowRetry) {
      userPrompt = `${buildProposalUserPrompt(master)}

Previous proposal failed structural gates. Regenerate with exactly ${Number(master.marks)} distinct one-mark points.`;
      continue;
    }
  }

  return {
    attempted: true,
    attemptCount: attempt,
    retried: attempt > 1,
    proposal: lastParsed,
    qualityGates: lastGates,
    proposalStatus: "no_safe_proposal",
    approvalStatus: "pending",
    raw: lastRaw,
  };
}

module.exports = {
  PROPOSAL_SYSTEM,
  buildProposalUserPrompt,
  parseProposalResponse,
  runMarkSchemeProposal,
};
