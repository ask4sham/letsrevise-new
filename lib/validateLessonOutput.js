import {
  REQUIRED_SECTION_RULES,
  REQUIRED_TEXT_MARKERS,
} from "./lessonRequirements";

function normalise(value = "") {
  return String(value).toLowerCase().trim();
}

function getBlockText(block = {}) {
  return [
    block.text,
    block.html,
    block.title,
    Array.isArray(block.items)
      ? block.items
          .map((item) =>
            typeof item === "string"
              ? item
              : `${item.term || ""} ${item.definition || ""}`
          )
          .join(" ")
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Raw lesson string when present; otherwise concatenated block text (for Key Insight counts). */
function getPrimaryText(text = "", blocks = []) {
  if (String(text).trim()) {
    return text;
  }
  return blocks.map(getBlockText).join("\n");
}

function hasType(blocks, type) {
  return blocks.some((block) => block.type === type);
}

function countAnyType(blocks, types = []) {
  return blocks.filter((block) => types.includes(block.type)).length;
}

function findKeywordBlock(blocks = []) {
  return blocks.find(
    (block) =>
      block.type === "keywords" ||
      block.type === "key-words" ||
      normalise(block.title).includes("key words") ||
      normalise(block.title).includes("keywords")
  );
}

function getKeywordCount(blocks = [], text = "") {
  const keywordBlock = findKeywordBlock(blocks);

  if (keywordBlock?.items?.length) return keywordBlock.items.length;

  const keywordSectionMatch = String(text).match(
    /(KEYWORDS|Key words|Keywords)[\s\S]*$/i
  );

  if (!keywordSectionMatch) return 0;

  return keywordSectionMatch[0]
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        /<strong>.+?<\/strong>\s*[–-]\s*.+/i.test(line) ||
        /\*\*.+?\*\*\s*[–-]\s*.+/.test(line)
    ).length;
}

function checkpointIssues(blocks = []) {
  const issues = [];
  const checkpointBlocks = blocks.filter((block) =>
    ["checkpoint", "quick-check"].includes(block.type)
  );

  checkpointBlocks.forEach((block, index) => {
    const label = block.title || `Checkpoint ${index + 1}`;

    if (!block.question?.trim()) {
      issues.push(`${label}: missing question.`);
    }

    if (!Array.isArray(block.options) || block.options.length !== 4) {
      issues.push(`${label}: must have exactly 4 options.`);
    }

    if (!block.answer?.trim()) {
      issues.push(`${label}: missing answer.`);
    }

    if (Array.isArray(block.options) && block.options.length === 4 && block.answer) {
      const answer = String(block.answer).trim();
      const matchesOption = block.options.some(
        (option) => String(option).trim() === answer
      );

      if (!matchesOption) {
        issues.push(`${label}: answer must match one option exactly.`);
      }
    }
  });

  return issues;
}

function examPracticeIssues(blocks = [], text = "") {
  const issues = [];
  const examBlock = blocks.find(
    (block) =>
      block.type === "exam-practice" ||
      normalise(block.title).includes("exam practice")
  );

  const source = examBlock?.text || examBlock?.html || text;

  if (!/Q1\s*\(1\s*mark\)/i.test(source)) {
    issues.push("Exam practice is missing Q1 (1 mark).");
  }

  if (!/Q2\s*\(2\s*marks?\)/i.test(source)) {
    issues.push("Exam practice is missing Q2 (2 marks).");
  }

  if (!/Q3\s*\(3\s*marks?\)/i.test(source)) {
    issues.push("Exam practice is missing Q3 (3 marks).");
  }

  if (!/Q4\s*\(4\s*marks?\)/i.test(source)) {
    issues.push("Exam practice is missing Q4 (4 marks).");
  }

  if (!/Reveal Model Answer/i.test(source) && !/Model Answer:/i.test(source)) {
    issues.push("Exam practice needs hidden model answers.");
  }

  if (!/Q3[\s\S]*?(Reveal Model Answer|Model Answer:)[\s\S]*?(Q4|$)/i.test(source)) {
    issues.push("Q3 needs a model answer.");
  }

  if (!/Q4[\s\S]*?(Reveal Model Answer|Model Answer:)/i.test(source)) {
    issues.push("Q4 needs a model answer.");
  }

  return issues;
}

function textHasBold(text = "") {
  return /<strong>.+?<\/strong>/i.test(text) || /\*\*.+?\*\*/.test(text);
}

function countMatches(text = "", regex) {
  return (String(text).match(regex) || []).length;
}

function lessonHasModernBlocks(blocks = []) {
  return blocks.some((block) =>
    [
      "hook",
      "core-rule",
      "drag-drop-match",
      "step-by-step-diagram",
      "interactive-diagram",
      "checkpoint",
      "quick-check",
    ].includes(block.type)
  );
}

export function buildSystemIntelligenceReport(blocks = [], text = "") {
  const types = blocks.map((block) => block.type);
  const fullText = [
    text,
    blocks.map(getBlockText).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const strengths = [];
  const criticalFixes = [];
  const suggestions = [];

  const has = (type) => types.includes(type);
  const count = (type) => types.filter((item) => item === type).length;

  if (has("drag-drop-match")) {
    strengths.push("Includes drag-and-drop active recall.");
  } else {
    criticalFixes.push("Add a Drag and drop match block.");
  }

  if (has("interactive-diagram")) {
    strengths.push("Includes an interactive diagram task.");
  } else {
    criticalFixes.push("Add an Interactive diagram block.");
  }

  if (has("step-by-step-diagram")) {
    strengths.push("Includes a step-by-step process diagram.");
  } else {
    criticalFixes.push("Add a Step-by-step diagram block.");
  }

  if (count("checkpoint") + count("quick-check") >= 2) {
    strengths.push("Includes enough checkpoint-style questioning.");
  } else {
    criticalFixes.push("Add at least 2 checkpoint-style questions.");
  }

  if (!has("common-mistake")) {
    suggestions.push("Add a Common mistake block to prevent easy exam mark losses.");
  }

  if (!has("exam-tip")) {
    suggestions.push("Add an Exam tip block with clear examiner guidance.");
  }

  if (!has("worked-example")) {
    suggestions.push("Add a Worked example block with a hidden model answer.");
  }

  if (!has("final-memory-rule")) {
    suggestions.push("Add a Final memory rule block.");
  }

  if (!/Weak answer:/i.test(fullText)) {
    suggestions.push("Add a Weak answer / Better answer / Full-mark answer comparison.");
  }

  if (
    !/cause\s*→\s*effect/i.test(fullText) &&
    !/structure\s*→\s*function/i.test(fullText) &&
    !/process\s*→\s*effect/i.test(fullText)
  ) {
    suggestions.push("Add more cause → effect or structure → function explanation chains.");
  }

  if (!/🌍\s*Why this matters/i.test(fullText)) {
    suggestions.push("Add a 🌍 Why this matters line.");
  }

  const score = 100 - criticalFixes.length * 12 - suggestions.length * 4;
  const boundedScore = Math.max(0, Math.min(100, score));

  let rating = "Needs work";
  if (boundedScore >= 90 && criticalFixes.length === 0) {
    rating = "SS1 Excellent";
  } else if (boundedScore >= 75) {
    rating = "Strong";
  } else if (boundedScore >= 60) {
    rating = "Usable";
  }

  return {
    score: boundedScore,
    rating,
    strengths,
    criticalFixes,
    suggestions,
    nextBestAction:
      criticalFixes[0] ||
      suggestions[0] ||
      "Lesson is ready for LetsRevise publishing.",
  };
}

/** Score weights: errors heaviest; warnings lightest; markers and sections moderate. */
const SCORE_WEIGHTS = {
  error: 10,
  warning: 2,
  missingMarker: 4,
  missingSection: 5,
};

export function validateLessonOutput(blocks = [], text = "") {
  const types = blocks.map((block) => block.type);
  const allBlockText = blocks.map(getBlockText).join("\n");
  const fullText = [text, allBlockText].filter(Boolean).join("\n");
  const primaryText = getPrimaryText(text, blocks);

  const missingSections = REQUIRED_SECTION_RULES.filter(
    (rule) => !types.includes(rule.key)
  );

  const missingMarkers = REQUIRED_TEXT_MARKERS.filter(
    (rule) => !rule.test(fullText)
  );

  const warnings = [];
  const errors = [];

  if (!textHasBold(fullText)) {
    warnings.push("No bold key terms detected.");
  }

  if (!/👉/.test(fullText)) {
    warnings.push("Teacher-speak cue markers like 👉 are missing.");
  }

  const keyInsightMatches = countMatches(primaryText, /💡\s*Key Insight/gi);
  if (keyInsightMatches !== 1) {
    errors.push("There should be exactly one 💡 Key Insight.");
  }

  const diagramBlockCount = countAnyType(blocks, [
    "diagram",
    "interactive-diagram",
    "step-by-step-diagram",
  ]);

  const legacyDiagramSuggestionCount = countMatches(
    fullText,
    /📷\s*Diagram Suggestion/gi
  );

  const totalDiagramCount = Math.max(
    diagramBlockCount,
    legacyDiagramSuggestionCount
  );

  if (totalDiagramCount !== 3) {
    errors.push("There should be exactly 3 diagram-related blocks.");
  }

  if (!lessonHasModernBlocks(blocks)) {
    warnings.push("Lesson appears text-heavy. Use modern LetsRevise block types.");
  }

  if (!hasType(blocks, "hook")) {
    warnings.push("Missing Hook (text) block.");
  }

  if (!hasType(blocks, "core-rule")) {
    warnings.push("Missing Core rule (key idea) block.");
  }

  if (!hasType(blocks, "drag-drop-match")) {
    errors.push("Missing Drag and drop match block.");
  }

  if (!hasType(blocks, "step-by-step-diagram")) {
    errors.push("Missing Step-by-step diagram (process) block.");
  }

  if (!hasType(blocks, "interactive-diagram")) {
    errors.push("Missing Interactive diagram block.");
  }

  const checkpointStyleCount = countAnyType(blocks, ["checkpoint", "quick-check"]);

  if (checkpointStyleCount < 2) {
    errors.push("Lesson must include at least 2 checkpoint-style blocks.");
  }

  if (!hasType(blocks, "common-mistake")) {
    warnings.push("Missing Common mistake block.");
  }

  if (!hasType(blocks, "exam-tip")) {
    warnings.push("Missing Exam tip (concept) block.");
  }

  if (!hasType(blocks, "worked-example")) {
    warnings.push("Missing Worked example (checkpoint) block.");
  }

  if (!hasType(blocks, "synthesis")) {
    warnings.push("Missing Synthesis (key idea) block.");
  }

  if (!hasType(blocks, "self-check-question")) {
    warnings.push("Missing Self-check question block.");
  }

  if (!hasType(blocks, "final-memory-rule")) {
    warnings.push("Missing Final memory rule block.");
  }

  const keywordCount = getKeywordCount(blocks, fullText);

  if (keywordCount !== 10) {
    errors.push(`Keywords block must contain exactly 10 keywords. Found ${keywordCount}.`);
  }

  checkpointIssues(blocks).forEach((issue) => errors.push(issue));
  examPracticeIssues(blocks, fullText).forEach((issue) => errors.push(issue));

  if (!/Weak answer:/i.test(fullText)) {
    warnings.push("Missing at least one Weak answer example.");
  }

  if (!/Better answer:/i.test(fullText)) {
    warnings.push("Missing at least one Better answer example.");
  }

  if (!/Full-mark answer:/i.test(fullText)) {
    warnings.push("Missing at least one Full-mark answer example.");
  }

  if (!/common mistake/i.test(fullText) && !/students often confuse/i.test(fullText)) {
    warnings.push("Misconception correction is not explicit enough.");
  }

  const intelligenceBase = buildSystemIntelligenceReport(blocks, fullText);
  const intelligence = {
    ...intelligenceBase,
    nextBestAction:
      errors.length > 0
        ? errors[0]
        : warnings.length > 0
        ? warnings[0]
        : intelligenceBase.nextBestAction,
  };

  const score =
    100 -
    missingSections.length * SCORE_WEIGHTS.missingSection -
    missingMarkers.length * SCORE_WEIGHTS.missingMarker -
    errors.length * SCORE_WEIGHTS.error -
    warnings.length * SCORE_WEIGHTS.warning;

  const boundedScore = Math.max(0, Math.min(100, score));

  let rating = "Needs work";
  if (boundedScore >= 90 && errors.length === 0) {
    rating = "Excellent";
  } else if (boundedScore >= 75) {
    rating = "Strong";
  } else if (boundedScore >= 60) {
    rating = "Usable";
  }

  return {
    score: boundedScore,
    rating,
    missingSections,
    missingMarkers,
    errors,
    warnings,
    intelligence,
  };
}
