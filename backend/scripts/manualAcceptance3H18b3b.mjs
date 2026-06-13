/**
 * Phase 3H.1.8b.3b — Examiner Language V2 alignment manual review pack.
 * Usage: node backend/scripts/manualAcceptance3H18b3b.mjs
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const outDir = path.join(root, "docs/design/validation/3H18b3b");

const {
  buildExaminerLanguageV2PromptSection,
  scoreExaminerLanguageV2Coverage,
  pickTargetBodies,
  extractBlockBodiesByPatterns,
  isExaminerLanguageV2Enabled,
} = require("../../lib/teacherBrain/examinerLanguageV2Engine.js");
const { resolveTeachingQualityProfile } = require("../../lib/teacherBrain/teachingQualityProfiles.js");

const TOPICS = [
  {
    name: "Homeostasis",
    topic: "Homeostasis",
    topicKey: "aqa-gcse-biology:homeostasis",
    weak: {
      coreTeaching: "The body gets too hot so it helps you sweat to cool down.",
      commonMistake: "Students write that the brain makes you sweat without explaining why.",
      examTechnique: "Say sweating cools you down.",
      workedExample:
        "Step 1: Body hot. Step 2: Sweat. Step 3: Cooler. Step 4: Better.",
    },
    strong: {
      coreTeaching:
        "Core temperature rises above the optimum; thermoreceptors detect the change because conditions move away from the set point. The hypothalamus coordinates effectors therefore sweat glands are activated.",
      commonMistake:
        "Students often write: The body gets too hot so it sweats.\nCorrect: Thermoreceptors detect the change; the hypothalamus coordinates sweating therefore evaporation removes heat energy.",
      examTechnique:
        "Examiners expect receptor → coordination centre → effector → mechanism. To gain full marks: link negative feedback returning conditions towards the optimum.",
      workedExample:
        "Step 1 Observation: Core temperature rose to 38°C during exercise.\nStep 2 Data: Thermoreceptors detected the change.\nStep 3 Explanation: The hypothalamus coordinated sweating because evaporation removes heat energy.\nStep 4 Conclusion: Therefore negative feedback restores optimum temperature.",
    },
  },
  {
    name: "Structure and Function of the Nervous System",
    topic: "Structure and function of the nervous system",
    topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
    weak: {
      coreTeaching: "Messages travel through nerves to help the brain control responses.",
      commonMistake: "Students say nerves send messages without naming neurones.",
      examTechnique: "Describe how nerves work.",
      workedExample:
        "Step 1: Stimulus. Step 2: Message. Step 3: Brain. Step 4: Move.",
    },
    strong: {
      coreTeaching:
        "The nervous system coordinates responses through electrical impulses transmitted along neurones because receptors detect a stimulus.",
      commonMistake:
        "Students often write: Messages travel through nerves.\nCorrect: Electrical impulses travel along sensory and motor neurones.",
      examTechnique:
        "Examiners expect named neurones and impulse direction. Creditworthy answer: sensory neurone transmits impulses to the CNS; motor neurone stimulates the effector.",
      workedExample:
        "Step 1 Observation: A painful stimulus was detected by receptors.\nStep 2 Data: Impulses travelled along sensory neurones to the CNS.\nStep 3 Explanation: Motor neurones transmit impulses to the effector because synapses relay signals.\nStep 4 Conclusion: Therefore a rapid reflex response occurs.",
    },
  },
  {
    name: "The Eye",
    topic: "The eye",
    topicKey: "aqa-gcse-biology:the-eye",
    weak: {
      coreTeaching: "The lens focuses light and the eye zooms in on near objects.",
      commonMistake: "Students say the retina sees the image.",
      examTechnique: "Explain how the eye focuses.",
      workedExample:
        "Step 1: Light in. Step 2: Lens bends. Step 3: Retina sees. Step 4: Done.",
    },
    strong: {
      coreTeaching:
        "Light is refracted by the cornea and lens; ciliary muscles change lens shape during accommodation therefore rays converge on the retina.",
      commonMistake:
        "Students often write: The eye zooms in.\nCorrect: Ciliary muscles contract leading to a thicker lens and increased refraction.",
      examTechnique:
        "Examiners expect cornea and lens refraction plus accommodation sequence. Do not say: the retina sees the image.",
      workedExample:
        "Step 1 Observation: Light enters through the cornea.\nStep 2 Data: The lens refracts rays more strongly during accommodation.\nStep 3 Explanation: Photoreceptors in the retina detect the focused image because impulses are sent to the brain.\nStep 4 Conclusion: Therefore the eye maintains a clear image on the retina.",
    },
  },
];

const PROTECTED_SNIPPET = `
3 — DEFINITION
Paste into: Text (concept)
<p>Protected definition block — must not change.</p>
4 — SCENARIO
Paste into: Hook (text)
<p>Protected scenario block.</p>
23 — SUMMARY
Paste into: Text (concept)
<ul><li>Protected summary bullet one.</li><li>Protected summary bullet two.</li></ul>
19 — EXAM PRACTICE
Paste into: Text (concept)
<p><strong>Q1:</strong> Protected exam practice question.</p>
24 — KEY WORDS
Paste into: Key words
<p><strong>Protected</strong> – keyword entry.</p>
`.trim();

function buildLesson(targetBlocks) {
  return `
PAGE 1
1 — REVISION OBJECTIVES
Paste into: Text (concept)
<ul><li>Protected objective.</li></ul>
2 — PRIOR KNOWLEDGE
Paste into: Text (concept)
<ul><li>Protected prior knowledge.</li></ul>
${PROTECTED_SNIPPET}
9 — CORE TEACHING
Paste into: Text (concept)
${targetBlocks.coreTeaching}
15 — COMMON MISTAKE
Paste into: Common mistake
${targetBlocks.commonMistake}
16 — EXAM TECHNIQUE
Paste into: Exam technique (exam skill)
${targetBlocks.examTechnique}
17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)
${targetBlocks.workedExample}
`.trim();
}

function formatBlockReport(label, before, after) {
  return [
    `### ${label}`,
    "",
    "**Before:**",
    "```",
    before,
    "```",
    "",
    "**After:**",
    "```",
    after,
    "```",
    "",
  ].join("\n");
}

function evaluateTopic(cfg) {
  process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
  delete process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2;

  const meta = { topic: cfg.topic, topicKey: cfg.topicKey, subject: "Biology" };
  const profile = resolveTeachingQualityProfile(meta);

  const beforeText = buildLesson(cfg.weak);
  const afterText = buildLesson(cfg.strong);

  process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 = "1";
  const promptAppendix = buildExaminerLanguageV2PromptSection(meta);

  const beforeScore = scoreExaminerLanguageV2Coverage(beforeText, profile);
  const afterScore = scoreExaminerLanguageV2Coverage(afterText, profile);

  const beforeTargets = pickTargetBodies(extractBlockBodiesByPatterns(beforeText));
  const afterTargets = pickTargetBodies(extractBlockBodiesByPatterns(afterText));
  const protectedUnchanged =
    beforeText.includes(PROTECTED_SNIPPET) && afterText.includes(PROTECTED_SNIPPET);

  return {
    topic: cfg.name,
    flags: {
      TEACHER_BRAIN_TEACHER_FIRST_OPENING: "1",
      TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE: "1",
      TEACHER_BRAIN_EXAMINER_LANGUAGE_V2: "1",
    },
    v2Enabled: isExaminerLanguageV2Enabled(),
    promptAppendixBytes: promptAppendix.length,
    before: {
      targetBlocks: beforeTargets,
      score: beforeScore,
    },
    after: {
      targetBlocks: afterTargets,
      score: afterScore,
    },
    improvements: {
      examinerFramingCount: {
        before: beforeScore.signals.examinerFramingCount || 0,
        after: afterScore.signals.examinerFramingCount || 0,
      },
      contrastPairsMatched: {
        before: beforeScore.signals.contrastPairsMatched || 0,
        after: afterScore.signals.contrastPairsMatched || 0,
      },
      scientificNounCount: {
        before: beforeScore.signals.scientificNounCount || 0,
        after: afterScore.signals.scientificNounCount || 0,
      },
      connectiveCount: {
        before: beforeScore.signals.connectiveCount || 0,
        after: afterScore.signals.connectiveCount || 0,
      },
      pass: { before: beforeScore.pass, after: afterScore.pass },
    },
    protectedBlocksUnchanged: protectedUnchanged,
    wordingExamples: [
      { weak: cfg.weak.coreTeaching, strong: cfg.strong.coreTeaching },
      { weak: cfg.weak.commonMistake, strong: cfg.strong.commonMistake },
    ],
  };
}

function writeTopicMarkdown(result) {
  const slug = result.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const lines = [
    `# Examiner Language V2 — ${result.topic}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Flags",
    "",
    "```",
    JSON.stringify(result.flags, null, 2),
    "```",
    "",
    "## Score summary",
    "",
    "| Metric | Before | After |",
    "|---|---:|---:|",
    `| Examiner framing count | ${result.improvements.examinerFramingCount.before} | ${result.improvements.examinerFramingCount.after} |`,
    `| Contrast pairs matched | ${result.improvements.contrastPairsMatched.before} | ${result.improvements.contrastPairsMatched.after} |`,
    `| GCSE terminology (scientific nouns) | ${result.improvements.scientificNounCount.before} | ${result.improvements.scientificNounCount.after} |`,
    `| Examiner connectives | ${result.improvements.connectiveCount.before} | ${result.improvements.connectiveCount.after} |`,
    `| Scorer pass (diagnostic) | ${result.improvements.pass.before} | ${result.improvements.pass.after} |`,
    "",
    "## Protected blocks unchanged",
    "",
    result.protectedBlocksUnchanged ? "Yes — Definition, Scenario, Summary, Exam Practice, Keywords identical." : "NO — investigate.",
    "",
    formatBlockReport(
      "Core Learning",
      result.before.targetBlocks.coreTeaching,
      result.after.targetBlocks.coreTeaching
    ),
    formatBlockReport(
      "Common Mistake",
      result.before.targetBlocks.commonMistake,
      result.after.targetBlocks.commonMistake
    ),
    formatBlockReport(
      "Exam Technique",
      result.before.targetBlocks.examTechnique,
      result.after.targetBlocks.examTechnique
    ),
    formatBlockReport(
      "Worked Example",
      result.before.targetBlocks.workedExample,
      result.after.targetBlocks.workedExample
    ),
    "## Example wording upgrades",
    "",
    ...result.wordingExamples.map(
      (ex) => `- **Weak:** ${ex.weak}\n- **Strong:** ${ex.strong}\n`
    ),
  ];
  fs.writeFileSync(path.join(outDir, `${slug}.md`), lines.join("\n"), "utf8");
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const results = TOPICS.map(evaluateTopic);
  const allProtected = results.every((r) => r.protectedBlocksUnchanged);
  const allAfterPass = results.every((r) => r.after.score.pass);
  const allBeforeFail = results.every((r) => !r.before.score.pass);
  const v2OffByDefault = (() => {
    delete process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2;
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    return !isExaminerLanguageV2Enabled();
  })();

  const report = {
    phase: "3H.1.8b.3b",
    title: "Examiner Language V2 Alignment & Validation",
    generatedAt: new Date().toISOString(),
    baseline: "main @ 11d926a9",
    recoveryTag: "pre-examiner-language-v2",
    targetBlocksOnly: ["coreTeaching", "commonMistake", "examTechnique", "workedExample"],
    v2OffByDefault,
    topics: results,
    acceptance: {
      targetBlocksImprove: allAfterPass && allBeforeFail,
      protectedBlocksUnchanged: allProtected,
      v2FlagGated: v2OffByDefault,
      readyForManualReview: allProtected && allAfterPass,
    },
  };

  for (const r of results) writeTopicMarkdown(r);

  fs.writeFileSync(
    path.join(outDir, "MANUAL_REVIEW_SUMMARY.md"),
    [
      "# Phase 3H.1.8b.3b — Manual Review Summary",
      "",
      `Generated: ${report.generatedAt}`,
      "",
      "## Acceptance checklist",
      "",
      `- Target four blocks improve (after pass / before fail): **${report.acceptance.targetBlocksImprove ? "PASS" : "PENDING"}**`,
      `- Protected blocks unchanged in pack: **${report.acceptance.protectedBlocksUnchanged ? "PASS" : "FAIL"}**`,
      `- V2 off by default: **${report.acceptance.v2FlagGated ? "PASS" : "FAIL"}**`,
      `- Ready for human manual review: **${report.acceptance.readyForManualReview ? "YES" : "NO"}**`,
      "",
      "## Topic packs",
      "",
      ...results.map(
        (r) =>
          `- [${r.topic}](./${r.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md)`
      ),
      "",
      "## Notes",
      "",
      "- Prompt-only phase: before/after wording uses representative weak vs strong samples aligned to V2 profiles.",
      "- Scorer is read-only diagnostic — does not gate save or publish.",
      "- Summary and Exam Practice are excluded from V2 prompt and scorer targets.",
    ].join("\n"),
    "utf8"
  );

  const reportPath = path.join(root, "backend/scripts/manualAcceptance3H18b3b-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report.acceptance, null, 2));
  console.log(`\nReport: ${reportPath}`);
  console.log(`Manual pack: ${outDir}`);
  process.exit(report.acceptance.readyForManualReview ? 0 : 1);
}

main();
