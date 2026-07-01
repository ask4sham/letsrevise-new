/**
 * Apply a planned assessment journey to a JSON lesson draft (overrides LLM assessment blocks).
 */
const { SLOT_ORDER } = require("./assessmentJourneyPlanner");
const { validateAssessmentIntent } = require("./assessmentIntentValidator");

function safeStr(v, fallback = "") {
  return v == null ? fallback : String(v);
}

function wrapRevealAnswer(answer) {
  const a = safeStr(answer).trim();
  if (!a) return "";
  if (/<details/i.test(a)) return a;
  return `<details>\n<summary>Reveal Answer</summary>\n\n<p>${a}</p>\n\n</details>`;
}

function buildCheckpointBlock(item, role = "") {
  const ex = item.exemplar || {};
  const options = Array.isArray(ex.options) ? ex.options.filter(Boolean) : [];
  const questionType = ex.questionType || (options.length >= 2 ? "mcq" : "short");
  const block = {
    type: "checkpoint",
    prompt: ex.question,
    question: ex.question,
    questionType,
    options: questionType === "mcq" ? options : [],
    correctAnswer: ex.answer || options[0] || "",
    explanation: ex.modelAnswer || ex.answer || "",
    title: "",
  };
  if (role) block.role = role;
  if (item.slot === "workedExample") {
    block.role = "workedExample";
    block.answer = ex.modelAnswer || ex.answer || "";
    block.explanation = block.answer;
  }
  return block;
}

function buildSelfCheckBlock(item) {
  const ex = item.exemplar || {};
  return {
    type: "selfCheck",
    prompt: ex.question,
    question: ex.question,
    questionType: "short",
    options: [],
    correctAnswer: ex.answer || "",
    explanation: wrapRevealAnswer(ex.answer || ex.modelAnswer || ""),
    content: wrapRevealAnswer(ex.answer || ex.modelAnswer || ""),
    title: "",
  };
}

function buildExamPracticeBlock(item) {
  const ex = item.exemplar || {};
  const marks = ex.marks || 4;
  const q = ex.question || "";
  const scheme = (ex.markScheme || []).map((m) => `<li>${m}</li>`).join("");
  const model = ex.modelAnswer || ex.answer || "";
  return {
    type: "text",
    role: "examPractice",
    title: "Exam practice",
    content: [
      "<h2><strong>Exam practice</strong></h2>",
      `<p><strong>${q}</strong></p>`,
      scheme ? `<ul>${scheme}</ul>` : "",
      model ? `<p><strong>Model answer:</strong> ${model}</p>` : "",
      `<p><em>(${marks} marks)</em></p>`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function findBlockIndex(blocks, slot) {
  if (slot === "checkpoint") {
    return blocks.findIndex(
      (b) => b?.type === "checkpoint" && !safeStr(b.role, "")
    );
  }
  if (slot === "quickCheck") {
    return blocks.findIndex(
      (b) => b?.type === "checkpoint" && safeStr(b.role, "").toLowerCase() === "quickcheck"
    );
  }
  if (slot === "selfCheck") {
    return blocks.findIndex((b) => safeStr(b?.type, "").toLowerCase() === "selfcheck");
  }
  if (slot === "workedExample") {
    return blocks.findIndex(
      (b) =>
        b?.type === "checkpoint" && safeStr(b.role, "").toLowerCase() === "workedexample"
    );
  }
  if (slot === "examPractice") {
    return blocks.findIndex(
      (b) =>
        safeStr(b.role, "").toLowerCase() === "exampractice" ||
        /exam practice/i.test(b?.content || "")
    );
  }
  return -1;
}

function insertBlockAtAnchor(blocks, newBlock, slot) {
  const anchorOrder = {
    checkpoint: 0,
    quickCheck: 1,
    selfCheck: 2,
    workedExample: 3,
    examPractice: 4,
  };
  const target = anchorOrder[slot] ?? blocks.length;
  let insertAt = blocks.length;
  for (let i = 0; i < blocks.length; i++) {
    const bSlot = classifySlotForBlock(blocks[i]);
    if (bSlot && (anchorOrder[bSlot] ?? 99) > target) {
      insertAt = i;
      break;
    }
  }
  blocks.splice(insertAt, 0, newBlock);
}

function classifySlotForBlock(block) {
  const role = safeStr(block?.role, "").toLowerCase();
  const type = safeStr(block?.type, "").toLowerCase();
  if (type === "selfcheck") return "selfCheck";
  if (role === "quickcheck") return "quickCheck";
  if (role === "workedexample") return "workedExample";
  if (role === "exampractice") return "examPractice";
  if (type === "checkpoint") return "checkpoint";
  return null;
}

function blockFromPlanItem(item) {
  switch (item.slot) {
    case "checkpoint":
      return buildCheckpointBlock(item);
    case "quickCheck":
      return buildCheckpointBlock(item, "quickCheck");
    case "selfCheck":
      return buildSelfCheckBlock(item);
    case "workedExample":
      return buildCheckpointBlock(item, "workedExample");
    case "examPractice":
      return buildExamPracticeBlock(item);
    default:
      return null;
  }
}

/**
 * Mutates draft.pages[].blocks — replaces or inserts assessment blocks from plan.
 */
function applyAssessmentJourneyFromPlan(draft, opts = {}) {
  const plan = opts.plan || [];
  if (!draft?.pages?.length || !plan.length) {
    return { applied: false, reason: "no draft or plan" };
  }

  const page = draft.pages[0];
  if (!Array.isArray(page.blocks)) page.blocks = [];

  let replaced = 0;
  for (const item of plan) {
    const newBlock = blockFromPlanItem(item);
    if (!newBlock) continue;

    const idx = findBlockIndex(page.blocks, item.slot);
    if (idx >= 0) {
      page.blocks[idx] = { ...page.blocks[idx], ...newBlock };
      replaced++;
    } else {
      insertBlockAtAnchor(page.blocks, newBlock, item.slot);
      replaced++;
    }
  }

  if (opts.force !== false) {
    const validation = validateAssessmentIntent(draft, {
      plan,
      vocabulary: opts.vocabulary || [],
    });
    return { applied: replaced > 0, replaced, validation };
  }

  return { applied: replaced > 0, replaced };
}

module.exports = {
  applyAssessmentJourneyFromPlan,
  buildCheckpointBlock,
  buildSelfCheckBlock,
  buildExamPracticeBlock,
};
