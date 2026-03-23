/**
 * Curriculum-controlled AI lesson generation: board-specific prompt hints.
 * Used to tailor question phrasing, exam tips, and answer style per exam board.
 * Structure stays the same; only phrasing and style vary.
 */
const BOARDS = ["AQA", "Edexcel", "OCR", "WJEC"];

const BOARD_CONFIG = {
  AQA: {
    questionPhrasing: "Use AQA command words: state, describe, explain, compare, evaluate, suggest. Marks typically awarded for specific points.",
    examTipStyle: "Reference AQA mark schemes: credit correct scientific terms; mark allocation often 1 mark per point.",
    answerFormat: "Answers should match AQA mark scheme style: bullet points for multi-mark; key terms credited.",
    commandWords: ["state", "describe", "explain", "compare", "evaluate", "suggest", "calculate", "outline"],
  },
  Edexcel: {
    questionPhrasing: "Use Edexcel command words: define, describe, explain, discuss, evaluate, calculate. Questions often include application to unfamiliar contexts.",
    examTipStyle: "Edexcel marks for logical structure; extended responses need clear paragraphs; key terms must be defined.",
    answerFormat: "Answers should be well-structured; definitions before use; step-by-step for calculations.",
    commandWords: ["define", "describe", "explain", "discuss", "evaluate", "calculate", "suggest", "outline"],
  },
  OCR: {
    questionPhrasing: "Use OCR command words: state, define, describe, explain, suggest, evaluate. Often combines recall with application.",
    examTipStyle: "OCR mark schemes credit correct scientific vocabulary; some questions require linking ideas.",
    answerFormat: "Answers: concise for low-mark; extended for higher marks; use correct terminology.",
    commandWords: ["state", "define", "describe", "explain", "suggest", "evaluate", "compare", "outline"],
  },
  WJEC: {
    questionPhrasing: "Use WJEC command words: state, describe, explain, evaluate, calculate. Questions may be more scaffolded.",
    examTipStyle: "WJEC marks for correct scientific content; clarity and logical flow matter.",
    answerFormat: "Answers: match mark allocation; bullet points for multi-part; key terms credited.",
    commandWords: ["state", "describe", "explain", "evaluate", "calculate", "suggest", "define", "outline"],
  },
};

/**
 * Get board-specific hints for the AI prompt. Returns empty strings for unknown boards.
 */
function getBoardHints(board) {
  const key = (board || "").toString().trim().toUpperCase();
  return BOARD_CONFIG[key] || {};
}

/**
 * Build a prompt fragment for board-specific instructions.
 */
function buildBoardPromptFragment(board) {
  const hints = getBoardHints(board);
  if (!hints.questionPhrasing) return "";

  return [
    "\n\n## Exam board style (you must follow)",
    `- **Question phrasing:** ${hints.questionPhrasing}`,
    `- **Exam tips:** ${hints.examTipStyle}`,
    `- **Answer format:** ${hints.answerFormat}`,
  ].join("\n");
}

module.exports = {
  BOARDS,
  BOARD_CONFIG,
  getBoardHints,
  buildBoardPromptFragment,
};
