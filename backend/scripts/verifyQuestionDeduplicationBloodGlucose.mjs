/**
 * Verify question deduplication on Control of blood glucose — generator autofix path.
 * Usage: node backend/scripts/verifyQuestionDeduplicationBloodGlucose.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { deterministicAutoFixLesson } = await import("../../lib/deterministicAutoFixLesson.js");
const {
  listQuestionBlocksInLesson,
  isGenericPlaceholderStem,
  normalizeQuestionStem,
} = require("../../lib/questionDeduplicationGuard.js");

const TOPIC = "Control of blood glucose concentration";
const TOPIC_KEY = "aqa-biology-gcse:homeostasis-and-response:control-blood-glucose";

/** Simulated post-LLM draft: one topic MCQ + malformed checkpoint → autofix injects generics */
const DRAFT = `
LESSON OBJECTIVE FIELD:
Describe how insulin and glucagon control blood glucose.

SHORT SUMMARY FIELD:
Blood glucose is regulated by hormones from the pancreas.

1 — REVISION OBJECTIVES
Paste into: Text (concept)
<ul>
<li>Describe how insulin lowers blood glucose</li>
<li>Explain how glucagon raises blood glucose</li>
</ul>

2 — PRIOR KNOWLEDGE
Paste into: Text (concept)
<ul><li>Cells use glucose for respiration</li></ul>

5 — CHECKPOINT
Paste into: Checkpoint block
Question:
When blood glucose rises above the set point, which hormone does the pancreas release?
Option 1:
Insulin
Option 2:
Glucagon
Option 3:
ADrenaline
Option 4:
Thyroxine
Answer:
Insulin

8 — QUICK CHECK
Paste into: Quick check (checkpoint)
Question:
Broken

12 — SELF-CHECK QUESTION
Paste into: Self-check question
<p><strong>Self-check:</strong> can you explain <strong>Control of blood glucose concentration</strong> without only naming terms?</p>

20 — EXAM PRACTICE
Paste into: Exam practice
<h2><strong>Exam practice</strong></h2>
<p>Placeholder</p>
`.trim();

function collectQuestions(text) {
  return listQuestionBlocksInLesson(text).map((b) => ({
    kind: b.kind,
    stem: b.stem,
    normalized: normalizeQuestionStem(b.stem),
  }));
}

function runChecks(text, fixesApplied) {
  const questions = collectQuestions(text);
  const assessment = questions.filter((q) =>
    ["checkpoint", "quickCheck", "selfCheck"].includes(q.kind)
  );

  const stems = assessment.map((q) => q.normalized).filter(Boolean);
  const uniqueStems = new Set(stems);
  const genericStems = assessment.filter((q) => isGenericPlaceholderStem(q.stem));

  const hay = text.toLowerCase();
  const mechanisms = {
    insulin: /insulin/.test(hay),
    glucagon: /glucagon/.test(hay),
    glycogen: /glycogen/.test(hay),
    negativeFeedback: /negative feedback/.test(hay),
  };

  const checkpointStems = assessment
    .filter((q) => q.kind === "checkpoint" || q.kind === "quickCheck")
    .map((q) => q.normalized);
  const selfCheckStems = assessment
    .filter((q) => q.kind === "selfCheck")
    .map((q) => q.normalized);

  const checks = {
    noRepeatedCheckpoint:
      new Set(checkpointStems).size === checkpointStems.length,
    noRepeatedSelfCheck:
      new Set(selfCheckStems).size === selfCheckStems.length,
    noGenericPlaceholder: genericStems.length === 0,
    dedupeFixApplied: fixesApplied.some((f) => /Question deduplication/i.test(f)),
    mechanismCoverage: Object.values(mechanisms).filter(Boolean).length >= 3,
    mechanisms,
    checkpointCount: checkpointStems.length,
    selfCheckCount: selfCheckStems.length,
    uniqueAssessmentStems: uniqueStems.size,
    totalAssessmentStems: stems.length,
    genericCount: genericStems.length,
  };

  return { checks, questions, assessment };
}

const { text, fixesApplied } = deterministicAutoFixLesson({
  text: DRAFT,
  subject: "Biology",
  topic: TOPIC,
  topicKey: TOPIC_KEY,
});

const { checks, assessment } = runChecks(text, fixesApplied);

console.log("=== Blood glucose deduplication verification ===");
console.log("Topic:", TOPIC);
console.log("Fixes applied:", fixesApplied.filter((f) => /dedup|checkpoint|Renumber/i.test(f)).join(" | "));
console.log("");
console.log("Assessment questions:");
for (const q of assessment) {
  console.log(`  [${q.kind}] ${q.stem.slice(0, 100)}${q.stem.length > 100 ? "…" : ""}`);
}
console.log("");
console.log("Checks:");
console.log("  No repeated checkpoint/quick-check:", checks.noRepeatedCheckpoint ? "PASS" : "FAIL");
console.log("  No repeated self-check:", checks.noRepeatedSelfCheck ? "PASS" : "FAIL");
console.log("  No generic placeholder stems:", checks.noGenericPlaceholder ? "PASS" : "FAIL");
console.log("  Dedupe fix in pipeline:", checks.dedupeFixApplied ? "PASS" : "FAIL");
console.log("  Mechanism coverage (≥3 of insulin/glucagon/glycogen/negative feedback):", checks.mechanismCoverage ? "PASS" : "FAIL", checks.mechanisms);
console.log("");

const allPass =
  checks.noRepeatedCheckpoint &&
  checks.noRepeatedSelfCheck &&
  checks.noGenericPlaceholder &&
  checks.dedupeFixApplied &&
  checks.mechanismCoverage;

if (!allPass) {
  console.error("VERIFICATION FAILED");
  process.exit(1);
}

console.log("VERIFICATION PASSED — safe to commit/tag generator-quality baseline.");
process.exit(0);
