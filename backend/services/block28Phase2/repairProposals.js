/**
 * Block 28 Phase 2 — repair proposals for retained questions only (read-only).
 * Does NOT invent generic mark-scheme filler.
 */
const { normalizeMarkSchemeLines, validateShortMarksMarkSchemeInvariant } = require("../../../lib/block28PracticePolicy");
const { extractCommandWord } = require("./classifyRepair");
const { SCHEME_STATUS, isGenericFillerPoint, assessSemanticReadiness } = require("./schemeQuality");

const REPAIR_ACTION = Object.freeze({
  KEEP_QUESTION_KEEP_MARKS: "KEEP_QUESTION_KEEP_MARKS",
  REVISE_QUESTION: "REVISE_QUESTION",
  CHANGE_MARKS: "CHANGE_MARKS",
  NEW_MASTER_REQUIRED: "NEW_MASTER_REQUIRED",
});

const MARK_DEMAND = Object.freeze({
  NATURAL: "NATURAL",
  BORDERLINE: "BORDERLINE",
  ARTIFICIALLY_PADDED: "ARTIFICIALLY_PADDED",
});

function countRecallItems(question) {
  const m = String(question).match(/\b(two|three|four|2|3|4)\b/i);
  if (/\bstate\b|\bgive\b|\bname\b|\blist\b/i.test(question) && m) {
    const n = { two: 2, three: 3, four: 4, "2": 2, "3": 3, "4": 4 }[m[1].toLowerCase()];
    return n || null;
  }
  return null;
}

function isSimpleRecallStem(question) {
  return /^(what is|where does|where is|how many|which organ|name the)\b/i.test(String(question).trim());
}

function inferNaturalMarks(question, schemeCount) {
  const q = String(question || "");
  const recallN = countRecallItems(q);
  if (recallN) return recallN;
  if (isSimpleRecallStem(q)) return 1;
  const cmd = extractCommandWord(q);
  if (cmd === "define" || cmd === "state" || cmd === "name") return Math.min(2, schemeCount || 2);
  if (cmd === "outline" || cmd === "suggest" || cmd === "justify") return Math.min(2, Math.max(schemeCount, 2));
  if (cmd === "explain" || cmd === "describe") return schemeCount >= 3 ? 4 : 2;
  if (cmd === "evaluate" || cmd === "compare" || cmd === "analyse" || cmd === "analyze") {
    return schemeCount >= 4 ? 4 : schemeCount >= 3 ? 3 : 2;
  }
  return Math.max(1, Math.min(4, schemeCount || 2));
}

function classifyMarkDemand(question, marks, proposedScheme, originalMarks = marks) {
  const natural = inferNaturalMarks(question, proposedScheme.length);
  const recallN = countRecallItems(question);
  const cmd = extractCommandWord(question);

  if (recallN && originalMarks > recallN) {
    return {
      verdict: MARK_DEMAND.ARTIFICIALLY_PADDED,
      note: `Recall-style stem implies ~${recallN} marks but question was ${originalMarks} marks.`,
      naturalMarks: recallN,
    };
  }
  if (isSimpleRecallStem(question) && originalMarks > 1) {
    return {
      verdict: MARK_DEMAND.ARTIFICIALLY_PADDED,
      note: `Simple recall stem; natural demand is 1 mark but question was ${originalMarks} marks.`,
      naturalMarks: 1,
    };
  }

  if (originalMarks > marks && marks <= natural) {
    return {
      verdict: MARK_DEMAND.BORDERLINE,
      note: `Reduced from ${originalMarks} to ${marks} marks because stem supports ~${natural} independent assessable idea(s).`,
      naturalMarks: natural,
    };
  }

  if (marks !== natural) {
    if (Math.abs(marks - natural) === 1 && (cmd === "evaluate" || cmd === "compare" || cmd === "analyse")) {
      return {
        verdict: MARK_DEMAND.BORDERLINE,
        note: `Proposed ${marks} marks; assessable content suggests ~${natural} marks for this ${cmd} question.`,
        naturalMarks: natural,
      };
    }
    if (marks > natural) {
      return {
        verdict: MARK_DEMAND.BORDERLINE,
        note: `Proposed ${marks} marks exceeds inferred natural demand of ~${natural} from stem and assessable content.`,
        naturalMarks: natural,
      };
    }
  }

  if (
    (cmd === "evaluate" || cmd === "compare" || cmd === "analyse") &&
    marks >= 4 &&
    proposedScheme.length < marks
  ) {
    return {
      verdict: MARK_DEMAND.BORDERLINE,
      note: `${cmd} at ${marks} marks requires ${marks} independent assessable ideas; only ${proposedScheme.length} substantive points available.`,
      naturalMarks: natural,
    };
  }

  return { verdict: MARK_DEMAND.NATURAL, note: null, naturalMarks: natural };
}

/**
 * @param {object} retained
 * @param {object} [context] - { overlapRisk, highOverlapInSet }
 */
function proposeRetainedRepair(retained, context = {}) {
  const question = String(retained.question || "");
  const currentMarks = Number(retained.marks) || 0;
  const currentScheme = normalizeMarkSchemeLines(retained.markScheme).filter((p) => !isGenericFillerPoint(p));
  const invCurrent = validateShortMarksMarkSchemeInvariant(currentMarks, currentScheme);

  let action = REPAIR_ACTION.KEEP_QUESTION_KEEP_MARKS;
  let proposedQuestion = question;
  let proposedMarks = currentMarks;
  let proposedScheme = [...currentScheme];
  let schemeStatus = SCHEME_STATUS.READY;
  let repairNote = "";

  const natural = inferNaturalMarks(question, currentScheme.length);

  if (invCurrent.ok && !currentScheme.some(isGenericFillerPoint)) {
    action = REPAIR_ACTION.KEEP_QUESTION_KEEP_MARKS;
    repairNote = "Already invariant-clean with substantive mark-scheme points.";
    schemeStatus = SCHEME_STATUS.READY;
  } else if (currentMarks > natural) {
    proposedMarks = natural;
    proposedScheme = currentScheme.slice(0, natural);
    action = REPAIR_ACTION.CHANGE_MARKS;
    repairNote = `Reduce marks from ${currentMarks} to ${natural}: ${classifyMarkDemand(question, natural, proposedScheme, currentMarks).note || "stem and assessable content support lower mark demand."}`;
    schemeStatus =
      proposedScheme.length === proposedMarks ? SCHEME_STATUS.READY : SCHEME_STATUS.HUMAN_REVIEW_REQUIRED;
  } else if (currentScheme.length < currentMarks) {
    proposedMarks = currentMarks;
    proposedScheme = [...currentScheme];
    action = REPAIR_ACTION.REVISE_QUESTION;
    schemeStatus = SCHEME_STATUS.HUMAN_REVIEW_REQUIRED;
    repairNote = `Mark scheme has ${currentScheme.length} substantive point(s) for ${currentMarks} marks — Biology must author ${currentMarks - currentScheme.length} additional specific mark point(s). No generic filler generated.`;
  } else if (currentScheme.some(isGenericFillerPoint)) {
    proposedMarks = currentMarks;
    proposedScheme = currentScheme.filter((p) => !isGenericFillerPoint(p));
    action = REPAIR_ACTION.REVISE_QUESTION;
    schemeStatus = SCHEME_STATUS.HUMAN_REVIEW_REQUIRED;
    repairNote = "Generic filler mark points removed — Biology must author specific assessable mark point(s).";
  } else {
    proposedMarks = currentMarks;
    proposedScheme = [...currentScheme];
    action = REPAIR_ACTION.REVISE_QUESTION;
    schemeStatus = SCHEME_STATUS.READY;
    repairNote = "Align question/scheme wording only.";
  }

  const markDemand = classifyMarkDemand(proposedQuestion, proposedMarks, proposedScheme, currentMarks);
  const invProposed = validateShortMarksMarkSchemeInvariant(proposedMarks, proposedScheme);

  const semantic = assessSemanticReadiness({
    marks: proposedMarks,
    markScheme: proposedScheme,
    stem: proposedQuestion,
    question: proposedQuestion,
    markDemand,
    overlapRisk: context.overlapRisk || "LOW",
    highOverlapInSet: context.highOverlapInSet || false,
    schemeStatus,
  });

  return {
    questionId: retained.questionId,
    action,
    repairNote,
    originalQuestion: question,
    proposedQuestion,
    originalMarks: currentMarks,
    proposedMarks,
    currentScheme: normalizeMarkSchemeLines(retained.markScheme),
    proposedScheme,
    schemeStatus,
    markDemand,
    semanticReadiness: semantic.semanticReadiness,
    semanticReadinessReasons: semantic.reasons,
    qualityGates: null,
    invariantPass: invProposed.ok && schemeStatus === SCHEME_STATUS.READY,
    confidence: schemeStatus === SCHEME_STATUS.HUMAN_REVIEW_REQUIRED ? "LOW" : "MEDIUM",
    overlapRisk: context.overlapRisk || "LOW",
  };
}

module.exports = {
  REPAIR_ACTION,
  MARK_DEMAND,
  proposeRetainedRepair,
  inferNaturalMarks,
  classifyMarkDemand,
  isSimpleRecallStem,
};
