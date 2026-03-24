/**
 * LetsRevise Lesson Quality Scoring System v1.0
 *
 * Evaluates teaching quality for both AI-generated and manually created lessons.
 * Sits on top of curriculum and structure validation.
 *
 * Bands: 0-39 poor, 40-54 weak, 55-69 acceptable, 70-84 strong, 85-100 publish-ready
 * Weights: structure=20, pedagogy=25, examReadiness=20, clarity=15, completeness=20
 */

const {
  validateLessonStructure,
  keyIdeaLooksSpecific,
  examTipLooksSpecific,
  blockMentionsComparison,
  blockMentionsApplication,
  blockFlowText,
  soundsTeacherLike,
  hasConcreteExample,
  blockRepeatsKnownIdea,
  soundsLikeTeacherQuestion,
  checkpointLooksReal,
} = require("../services/lessonDraftValidation");

function getBlocks(lesson) {
  if (Array.isArray(lesson?.blocks)) return lesson.blocks;
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  return pages.flatMap((p) => p?.blocks ?? []);
}

function getLessonQualityBand(score) {
  if (score >= 85) return "publish-ready";
  if (score >= 70) return "strong";
  if (score >= 55) return "acceptable";
  if (score >= 40) return "weak";
  return "poor";
}

function scoreLessonQuality(lesson, context = {}) {
  const blocks = getBlocks(lesson);
  const curriculumIssues = context.curriculumIssues || [];
  const structureIssues = context.structureIssues ?? validateLessonStructure(lesson);

  const issues = [];
  const suggestions = [];

  let structure = 20;
  let pedagogy = 25;
  let examReadiness = 20;
  let clarity = 15;
  let completeness = 20;

  const roles = new Set(blocks.map((b) => (b?.role ?? "").toString().trim()).filter(Boolean));
  const textBlocks = blocks.filter((b) => ["text"].includes((b?.type ?? "").toString().trim()));
  const examTips = blocks.filter((b) =>
    ["examTip", "examTips"].includes((b?.type ?? "").toString().trim())
  );
  const checkpoints = blocks.filter((b) => (b?.type ?? "").toString().trim() === "checkpoint");
  const diagrams = blocks.filter((b) => (b?.type ?? "").toString().trim() === "diagram");
  const keyIdeas = blocks.filter((b) =>
    ["keyIdea", "keyIdeas"].includes((b?.type ?? "").toString().trim())
  );

  const midFlow = Math.ceil(blocks.length / 2);
  const firstHalfFlow = blocks.slice(0, midFlow);
  const secondHalfFlow = blocks.slice(midFlow);
  const earlyComparisonFlow = firstHalfFlow.some((b) =>
    blockMentionsComparison(blockFlowText(b))
  );
  const laterApplicationFlow = secondHalfFlow.some((b) =>
    blockMentionsApplication(blockFlowText(b))
  );

  const fullText = blocks
    .map((b) =>
      [b?.title, b?.content, b?.prompt, b?.question, b?.answer, b?.explanation]
        .filter(Boolean)
        .map(String)
        .join(" ")
    )
    .join(" ")
    .toLowerCase();

  // STRUCTURE
  if (structureIssues.length > 0) {
    structure -= Math.min(16, structureIssues.length * 4);
    issues.push(...structureIssues);
  }

  if (!roles.has("workedExample")) {
    structure -= 6;
    issues.push("Missing worked example role.");
    suggestions.push("Add a checkpoint block with role 'workedExample'.");
  }

  if (!roles.has("hook")) {
    structure -= 4;
    issues.push("Missing hook.");
    suggestions.push("Start the lesson with a hook text block.");
  }

  if (!roles.has("finalMemoryRule")) {
    structure -= 3;
    issues.push("Missing final memory rule.");
    suggestions.push("End the lesson with a keyIdea final memory rule.");
  }

  if (structure < 0) structure = 0;

  // PEDAGOGY
  if (!roles.has("coreRule")) {
    pedagogy -= 5;
    issues.push("Missing core rule.");
    suggestions.push("Add a keyIdea block that states the main rule of the topic.");
  }

  if (!roles.has("commonMistake")) {
    pedagogy -= 5;
    issues.push("Missing misconception correction.");
    suggestions.push("Add a commonMistake block with incorrect vs correct thinking.");
  }

  const hasWhatToNotice = blocks.some(
    (b) =>
      (b?.role ?? "").toString().trim() === "whatToNotice" ||
      /what to notice/i.test((b?.title ?? "").toString())
  );

  if (!hasWhatToNotice) {
    pedagogy -= 5;
    issues.push("Missing 'What to Notice' guidance.");
    suggestions.push("Add a keyIdea block titled 'What to Notice' after diagrams.");
  }

  if (!roles.has("synthesis")) {
    pedagogy -= 4;
    issues.push("Missing synthesis summary.");
    suggestions.push("Add a synthesis block near the end of the lesson.");
  }

  if (!roles.has("patternRecognition")) {
    pedagogy -= 3;
    issues.push("Missing pattern recognition.");
    suggestions.push("Add a keyIdea block showing repeatable exam patterns.");
  }

  if (keyIdeas.length > 0 && !keyIdeas.some((b) => keyIdeaLooksSpecific(b, lesson))) {
    pedagogy -= 3;
    issues.push("Key ideas are too generic.");
    suggestions.push("Make key ideas topic-specific and exam-relevant.");
  }

  if (!earlyComparisonFlow) {
    pedagogy -= 2;
    issues.push("Core comparison appears too late or is missing.");
    suggestions.push("Introduce the main distinction earlier in the lesson.");
  }

  if (pedagogy < 0) pedagogy = 0;

  // EXAM READINESS
  if (examTips.length < 2) {
    examReadiness -= 4;
    issues.push("Too few exam tips.");
    suggestions.push("Add at least 2 examTip blocks.");
  }

  if (examTips.length > 0 && !examTips.some((b) => examTipLooksSpecific(b, lesson))) {
    examReadiness -= 3;
    issues.push("Exam tips are too generic.");
    suggestions.push("Write exam tips that explain how marks are earned in this topic.");
  }

  const hasWorkedExample = checkpoints.some(
    (b) =>
      (b?.role ?? "").toString().trim() === "workedExample" &&
      ((b?.answer ?? b?.explanation ?? "").toString().length > 30)
  );

  if (!hasWorkedExample) {
    examReadiness -= 8;
    issues.push("No strong worked example found.");
    suggestions.push("Add a worked exam checkpoint with a model answer.");
  }

  const examCommandCount = checkpoints.filter((b) =>
    /(explain|describe|compare)/i.test((b?.prompt ?? b?.question ?? "").toString())
  ).length;

  if (examCommandCount < 2) {
    examReadiness -= 4;
    issues.push("Too few exam-style command words.");
    suggestions.push("Use command words like Explain, Describe, and Compare.");
  }

  if (checkpoints.length < 3) {
    examReadiness -= 3;
    issues.push("Too few checkpoint questions.");
    suggestions.push("Include at least 3 checkpoint questions.");
  }

  if (examReadiness < 0) examReadiness = 0;

  // CLARITY
  let longTextBlocks = 0;
  for (const block of textBlocks) {
    const content = (block?.content ?? "").toString();
    const sentenceCount = (content.match(/[.!?]+/g) || []).length;
    if (sentenceCount > 6 || content.length > 500) longTextBlocks++;
  }

  if (longTextBlocks > 0) {
    clarity -= Math.min(8, longTextBlocks * 2);
    issues.push("Some text blocks are too long.");
    suggestions.push("Keep text blocks short and focused on one idea.");
  }

  const vaguePhrases = [
    "helps the cell do its job",
    "important for the function",
    "used for many things",
  ];

  const vagueMatches = vaguePhrases.filter((p) => fullText.includes(p));
  if (vagueMatches.length > 0) {
    clarity -= Math.min(4, vagueMatches.length);
    issues.push("Some explanations are vague.");
    suggestions.push(
      "Replace vague statements with specific feature-to-function explanations."
    );
  }

  if (clarity < 0) clarity = 0;

  // COMPLETENESS
  if (!laterApplicationFlow) {
    completeness -= 2;
    issues.push("Application section is weak or missing.");
    suggestions.push("Add a concrete real-world or medical use after the core explanation.");
  }

  if (curriculumIssues.length > 0) {
    completeness -= Math.min(10, curriculumIssues.length * 3);
    issues.push(...curriculumIssues.map((i) => `Curriculum: ${i}`));
    suggestions.push("Fix curriculum coverage gaps before publishing.");
  }

  if (diagrams.length < 2) {
    completeness -= 4;
    issues.push("Too few diagrams.");
    suggestions.push("Include at least 2 diagrams or image placeholders.");
  }

  if (keyIdeas.length < 4) {
    completeness -= 3;
    issues.push("Too few key idea blocks.");
    suggestions.push("Add more keyIdea blocks to reinforce major concepts.");
  }

  if (!roles.has("finalMemoryRule")) {
    completeness -= 3;
  }

  if (completeness < 0) completeness = 0;

  // V9 polish: mild bonus only (no penalties) — teacher-like reasoning, examples, rich worked answer
  let v9Bonus = 0;
  if (
    keyIdeas.length > 0 &&
    keyIdeas.filter((b) => soundsTeacherLike(blockFlowText(b))).length >= Math.ceil(keyIdeas.length * 0.5)
  ) {
    v9Bonus += 1;
  }
  if (
    textBlocks.length > 0 &&
    textBlocks.filter((b) => hasConcreteExample(blockFlowText(b))).length >= Math.ceil(textBlocks.length * 0.4)
  ) {
    v9Bonus += 1;
  }
  const workedForBonus = checkpoints.find(
    (b) => (b?.role ?? "").toString().trim() === "workedExample"
  );
  if (workedForBonus) {
    const ans = String(workedForBonus.answer ?? workedForBonus.explanation ?? "");
    const bulletCount = ans.split("\n").filter((l) => /^\s*[-•]\s?/.test(l.trimStart())).length;
    if (bulletCount >= 4) v9Bonus += 1;
  }
  v9Bonus = Math.min(3, v9Bonus);

  // V10 polish: mild bonus only — aha cue, concise key ideas, low stock stem repetition
  let v10Bonus = 0;
  const joinedFlows = blocks.map((b) => blockFlowText(b));
  if (
    joinedFlows.some(
      (t) =>
        /the key difference is this/i.test(t) || /anchor .{0,120} in three moves:/i.test(t)
    )
  ) {
    v10Bonus += 1;
  }
  if (
    keyIdeas.length > 0 &&
    keyIdeas.every((b) => {
      const lines = String(b?.content || "")
        .trim()
        .split("\n")
        .filter((l) => l.trim());
      return lines.length > 0 && lines.length <= 3;
    })
  ) {
    v10Bonus += 1;
  }
  const stemish =
    fullText.includes("stem cell") ||
    String(lesson?.topic || "")
      .toLowerCase()
      .includes("stem cell");
  if (stemish) {
    const stockRepeats = blocks.filter((b) => {
      const ft = blockFlowText(b);
      return (
        blockRepeatsKnownIdea(ft) &&
        !/because|for example|which means|in other words/i.test(ft)
      );
    }).length;
    if (stockRepeats <= 1) v10Bonus += 1;
  }
  v10Bonus = Math.min(2, v10Bonus);

  // V11 polish: teacher questions, sharp finale, exam-like quick checkpoints
  let v11Bonus = 0;
  if (blocks.some((b) => soundsLikeTeacherQuestion(blockFlowText(b)))) {
    v11Bonus += 1;
  }
  const finalRule = blocks.find((b) => (b?.role ?? "").toString().trim() === "finalMemoryRule");
  if (finalRule) {
    const fc = String(finalRule.content || "").trim();
    const lines = fc.split("\n").filter((l) => l.trim());
    if (lines.length >= 2 && fc.length >= 50) v11Bonus += 1;
  }
  const quickCps = blocks.filter(
    (b) =>
      (b?.type ?? "").toString().trim() === "checkpoint" &&
      (b?.role ?? "").toString().trim() !== "workedExample"
  );
  if (
    quickCps.length >= 2 &&
    quickCps.filter((b) => {
      const stem = `${b?.prompt ?? ""} ${b?.question ?? ""}`.trim();
      return checkpointLooksReal(stem);
    }).length >= 2
  ) {
    v11Bonus += 1;
  }
  v11Bonus = Math.min(2, v11Bonus);

  const score = Math.max(
    0,
    Math.min(100, structure + pedagogy + examReadiness + clarity + completeness + v9Bonus + v10Bonus + v11Bonus)
  );
  const band = getLessonQualityBand(score);
  const passed =
    score >= 70 &&
    structure >= 10 &&
    pedagogy >= 12 &&
    examReadiness >= 10;

  return {
    score,
    band,
    passed,
    categories: {
      structure,
      pedagogy,
      examReadiness,
      clarity,
      completeness,
    },
    issues: [...new Set(issues)],
    suggestions: [...new Set(suggestions)],
  };
}

module.exports = {
  scoreLessonQuality,
  getLessonQualityBand,
};
