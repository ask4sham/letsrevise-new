/**
 * Phase 3 Question Brain quality validator.
 * Fail-closed: wrong counts, banned/generic stems, weak MCQs, missing answers,
 * near-duplicate stems, and retrieval-image answer leaks.
 */

const { STAGE_STATUS } = require("./schemas");
const { findBannedStemHits } = require("./questionBanList");
const { studentImageRevealsAnswer, findRevealLeaks } = require("./studentImageSafety");

function normalizeStem(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function commandWord(stem) {
  const raw = String(stem || "").trim();
  const m = raw.match(
    /^(which|what|where|when|how|why|define|describe|explain|compare|evaluate|suggest|identify|name|state|outline|apply|a student)\b/i
  );
  return m ? m[1].toLowerCase() : "other";
}

function stemTokens(stem) {
  return new Set(
    normalizeStem(stem)
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccard(a, b) {
  const A = stemTokens(a);
  const B = stemTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function nearDuplicate(a, b) {
  const na = normalizeStem(a);
  const nb = normalizeStem(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return jaccard(a, b) >= 0.72;
}

function collectBannedRevealTerms(phase2) {
  const out = [];
  for (const a of phase2?.retrievalActivities || []) {
    for (const t of a?.bannedRevealTerms || []) {
      const s = String(t || "").trim();
      if (s) out.push(s);
    }
  }
  return out;
}

function phase1AnchorTerms(phase1) {
  const terms = [];
  for (const t of phase1?.keyTerms || []) {
    const s = String(t || "").trim();
    if (s.length >= 4) terms.push(s.toLowerCase());
  }
  for (const m of phase1?.misconceptions || []) {
    for (const part of [m?.wrong, m?.correct]) {
      const words = String(part || "")
        .toLowerCase()
        .match(/\b[a-z]{5,}\b/g);
      if (words) terms.push(...words.slice(0, 6));
    }
  }
  const sectionBlob = (phase1?.sections || [])
    .map((s) => String(s?.content || ""))
    .join(" ")
    .toLowerCase();
  return { terms: [...new Set(terms)], sectionBlob };
}

function questionLinksToPhase1(q, anchors) {
  const blob = `${q.prompt || ""} ${q.correctAnswer || ""} ${(q.options || []).join(" ")}`.toLowerCase();
  if (!blob.trim()) return false;
  if (!anchors.terms.length && !anchors.sectionBlob) return true;
  const hitTerm = anchors.terms.some((t) => blob.includes(t));
  if (hitTerm) return true;
  // Fallback: share at least one contentful token with core teaching text.
  const tokens = normalizeStem(blob).split(/\s+/).filter((w) => w.length > 4);
  let shared = 0;
  for (const t of tokens) {
    if (anchors.sectionBlob.includes(t)) shared += 1;
    if (shared >= 2) return true;
  }
  return false;
}

function questionRevealsRetrievalAnswer(q, bannedTerms) {
  const text = `${q.prompt || ""} ${(q.options || []).join(" ")}`;
  if (findRevealLeaks(text).length) return true;
  if (studentImageRevealsAnswer(text, bannedTerms)) return true;
  const lower = String(text || "").toLowerCase();
  for (const term of bannedTerms || []) {
    const t = String(term || "").trim().toLowerCase();
    if (t.length < 4) continue;
    // Giveaway phrasing for a labelled retrieval diagram.
    const giveaway = new RegExp(
      `\\b(the\\s+(highlighted|labelled|labeled|marked|shown|correct)\\s+(structure|cell|region|part)\\s+is\\s+${escapeRegExp(t)})|\\b(${escapeRegExp(t)}\\s+is\\s+(highlighted|labelled|labeled|marked\\s+correct))\\b`,
      "i"
    );
    if (giveaway.test(lower)) return true;
  }
  return false;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateQuestionItem(q, idx, bank, topic, issues) {
  const prefix = `${bank}:${idx}`;
  if (!q || typeof q !== "object") {
    issues.push(`${prefix}_missing`);
    return;
  }
  const prompt = String(q.prompt || "").trim();
  if (prompt.length < 12) issues.push(`${prefix}_prompt_too_short`);
  const bans = findBannedStemHits(prompt, { topic });
  for (const b of bans) issues.push(`${prefix}_${b}`);

  const answer = String(q.correctAnswer || "").trim();
  if (!answer) issues.push(`${prefix}_answer_missing`);

  const type = String(q.questionType || "").toLowerCase();
  if (type === "mcq") {
    const opts = Array.isArray(q.options) ? q.options.map((o) => String(o || "").trim()).filter(Boolean) : [];
    if (opts.length < 3) issues.push(`${prefix}_mcq_too_few_options`);
    const norm = opts.map((o) => o.toLowerCase());
    if (new Set(norm).size !== norm.length) issues.push(`${prefix}_mcq_duplicate_options`);
    if (opts.some((o) => /^option\s*[123]$/i.test(o))) issues.push(`${prefix}_mcq_option_filler`);
    if (answer && !opts.some((o) => o.toLowerCase() === answer.toLowerCase())) {
      issues.push(`${prefix}_mcq_answer_not_in_options`);
    }
  } else if (type !== "short") {
    issues.push(`${prefix}_bad_questionType`);
  }

  const purpose = String(q.purpose || "").trim().toLowerCase();
  if (!purpose) issues.push(`${prefix}_purpose_missing`);
}

/**
 * @param {object} phase3
 * @param {{ phase1?: object, phase2?: object, topic?: string }} [ctx]
 * @returns {{ ok: boolean, issues: string[] }}
 */
function validatePhase3Questions(phase3, ctx = {}) {
  const issues = [];
  if (!phase3 || typeof phase3 !== "object") {
    return { ok: false, issues: ["phase3_missing"] };
  }
  if (phase3.status !== STAGE_STATUS.COMPLETE) {
    issues.push("phase3_status_not_complete");
  }

  const topic = String(ctx.topic || phase3.topic || ctx.phase1?.topic || "").trim();
  const selfCheck = Array.isArray(phase3.selfCheck) ? phase3.selfCheck : null;
  const checkpoint = Array.isArray(phase3.checkpoint) ? phase3.checkpoint : null;
  const quiz = Array.isArray(phase3.quiz) ? phase3.quiz : null;

  if (!selfCheck || selfCheck.length !== 3) issues.push("phase3_selfCheck_must_be_exactly_3");
  if (!checkpoint || checkpoint.length !== 3) issues.push("phase3_checkpoint_must_be_exactly_3");
  if (!quiz || quiz.length !== 5) issues.push("phase3_quiz_must_be_exactly_5");

  const banks = [
    ["selfCheck", selfCheck || []],
    ["checkpoint", checkpoint || []],
    ["quiz", quiz || []],
  ];

  for (const [name, arr] of banks) {
    arr.forEach((q, i) => validateQuestionItem(q, i, name, topic, issues));
  }

  // Purpose contracts
  const scPurposes = (selfCheck || []).map((q) => String(q?.purpose || "").toLowerCase());
  if (selfCheck?.length === 3) {
    const need = ["recall", "definition"];
    const hasRecallDef = scPurposes.some((p) => need.includes(p));
    const hasMisc = scPurposes.includes("misconception");
    const hasExplainApply = scPurposes.some((p) => ["explain", "application"].includes(p));
    if (!hasRecallDef) issues.push("selfCheck_missing_recall_or_definition");
    if (!hasMisc) issues.push("selfCheck_missing_misconception");
    if (!hasExplainApply) issues.push("selfCheck_missing_explain_or_application");
    if (new Set(scPurposes.filter(Boolean)).size < 3) issues.push("selfCheck_purposes_not_varied");
  }

  const cpPurposes = (checkpoint || []).map((q) => String(q?.purpose || "").toLowerCase());
  if (checkpoint?.length === 3) {
    const hasUnderstanding = cpPurposes.some((p) => ["recall", "definition", "explain"].includes(p));
    const hasApplySeq = cpPurposes.some((p) => ["application", "sequence"].includes(p));
    const hasExplainMisc = cpPurposes.some((p) => ["explain", "misconception", "evaluate"].includes(p));
    if (!hasUnderstanding) issues.push("checkpoint_missing_understanding");
    if (!hasApplySeq) issues.push("checkpoint_missing_application_or_sequence");
    if (!hasExplainMisc) issues.push("checkpoint_missing_explanation_or_misconception");
    if (new Set(cpPurposes.filter(Boolean)).size < 3) issues.push("checkpoint_filler_clone_purposes");
  }

  const quizPurposes = (quiz || []).map((q) => String(q?.purpose || "").toLowerCase());
  if (quiz?.length === 5) {
    const requiredFamilies = [
      ["recall", "definition"],
      ["misconception"],
      ["comparison"],
      ["sequence", "application"],
      ["explain", "exam_style", "evaluate"],
    ];
    for (const family of requiredFamilies) {
      if (!quizPurposes.some((p) => family.includes(p))) {
        issues.push(`quiz_missing_purpose_family:${family[0]}`);
      }
    }
    if (new Set(quizPurposes.filter(Boolean)).size < 4) issues.push("quiz_purposes_not_varied");
  }

  // Near-duplicate stems within and across banks
  const all = [];
  for (const [name, arr] of banks) {
    (arr || []).forEach((q, i) => all.push({ name, i, prompt: q?.prompt || "" }));
  }
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (nearDuplicate(all[i].prompt, all[j].prompt)) {
        issues.push(
          `near_duplicate_stem:${all[i].name}${all[i].i}:${all[j].name}${all[j].j}`
        );
      }
    }
  }

  // Command-word repetition within an activity
  for (const [name, arr] of banks) {
    const cmds = (arr || []).map((q) => commandWord(q?.prompt));
    const counts = {};
    for (const c of cmds) counts[c] = (counts[c] || 0) + 1;
    for (const [c, n] of Object.entries(counts)) {
      if (n >= 3 && c !== "other") issues.push(`${name}_command_word_overused:${c}`);
    }
  }

  // Link to Phase 1 content
  const anchors = phase1AnchorTerms(ctx.phase1 || {});
  for (const [name, arr] of banks) {
    (arr || []).forEach((q, i) => {
      if (!questionLinksToPhase1(q, anchors)) {
        issues.push(`${name}:${i}_not_linked_to_phase1`);
      }
    });
  }

  // Do not reveal retrieval-image answers in student-facing question text
  const banned = collectBannedRevealTerms(ctx.phase2 || {});
  for (const [name, arr] of banks) {
    (arr || []).forEach((q, i) => {
      if (questionRevealsRetrievalAnswer(q, banned)) {
        issues.push(`${name}:${i}_reveals_retrieval_image_answer`);
      }
    });
  }

  if (phase3.questionsFinalised !== true) {
    issues.push("phase3_questionsFinalised_false");
  }

  return { ok: issues.length === 0, issues };
}

module.exports = {
  validatePhase3Questions,
  normalizeStem,
  nearDuplicate,
  commandWord,
  questionLinksToPhase1,
  questionRevealsRetrievalAnswer,
};
