/**
 * Model answer quality — concise, AQA language, command-word logic, why marks awarded.
 */

const { flattenPagesToBlocks, blockHaystack } = require("./blockText");

const MODEL_MARKERS = {
  reveal: [/reveal model answer/i, /reveal answer/i, /<details>/i],
  whyCorrect: [/why (this )?is correct/i, /why this gets marks/i, /earns marks because/i],
  examinerPhrase: [/examiner phrase/i, /in the exam, say/i, /use the phrase/i, /transfers energy/i],
  commandWord: [/command word/i, /step 1.*identify/i, /describe|explain|compare|evaluate/i],
  concise: [], // scored by absence of huge paragraphs in model blocks
};

/**
 * @param {object} blueprint
 */
function buildModelAnswerQualityPromptSection() {
  return [
    "MODEL ANSWER QUALITY (every reveal answer):",
    "- Correct answer (concise, AQA wording)",
    "- Why it is correct / Why this gets marks (2–4 bullets)",
    "- Examiner phrase pupils should reuse",
    "- Command-word logic where marks > 2 (Step 1 identify command word…)",
    "Avoid vague 'energy is made' — use transfers, links mechanism → outcome.",
  ].join("\n");
}

/**
 * @param {object[]} pages
 */
function analyzeModelAnswerQuality(pages) {
  const blocks = flattenPagesToBlocks(pages);
  let modelBlocks = 0;
  let qualityHits = 0;
  const gaps = [];

  blocks.forEach((block) => {
    const hay = blockHaystack(block);
    const isModel =
      hay.includes("reveal") ||
      hay.includes("model answer") ||
      hay.includes("full-mark") ||
      hay.includes("full mark");
    if (!isModel) return;
    modelBlocks++;
    if (/why|earns marks|because|transfers/i.test(hay)) qualityHits++;
    if (/examiner|in the exam/i.test(hay)) qualityHits++;
    if (/step 1|command word/i.test(hay)) qualityHits++;
  });

  if (!modelBlocks) gaps.push("No model/reveal answers with quality commentary");
  if (modelBlocks && qualityHits < 2) {
    gaps.push("Model answers lack 'why this gets marks' or examiner phrasing");
  }

  const modelAnswerScore =
    modelBlocks === 0 ? 35 : Math.min(100, 40 + qualityHits * 20);

  return { modelBlocks, modelAnswerScore, gaps };
}

module.exports = {
  buildModelAnswerQualityPromptSection,
  analyzeModelAnswerQuality,
};
