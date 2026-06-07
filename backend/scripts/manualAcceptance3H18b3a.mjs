/**
 * Phase 3H.1.8b.3a acceptance — Worked Reasoning V2 + V1 baseline preservation.
 * Usage: node backend/scripts/manualAcceptance3H18b3a.mjs
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const generatorRoot = path.resolve(root, "..", "letsrevise-generator");
const require = createRequire(import.meta.url);

const { deterministicAutoFixLesson } = require("../../lib/deterministicAutoFixLesson.js");
const { evaluateObjectivesAuthorityGate } = require("../../lib/teacherBrain/objectivesAuthority.js");
const { evaluateExamPracticeAuthorityGate } = require("../../lib/teacherBrain/examPracticeAuthority.js");
const { evaluateCheckpointAuthorityGate } = require("../../lib/teacherBrain/checkpointAuthority.js");
const {
  evaluateTeachingQualityUpgrade,
  computeTeachingQualityScore,
} = require("../../lib/teacherBrain/teachingQualityUpgrade.js");
const { scoreWorkedReasoningCoverage } = require("../../lib/teacherBrain/workedReasoningEngine.js");
const { resolveTeachingQualityProfile } = require("../../lib/teacherBrain/teachingQualityProfiles.js");

const TOPICS = [
  {
    name: "Nervous System",
    topic: "Structure and function of the nervous system",
    topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
    workedExample: `
17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)
Question: Explain how a reflex arc produces a rapid response to a painful stimulus. (4 marks)
1. Receptors detect the stimulus because they convert energy into an electrical impulse.
2. Sensory neurones carry impulses to the CNS therefore the spinal cord receives the signal.
3. Relay neurones pass impulses across synapses so that motor neurones are activated.
4. Motor neurones stimulate the effector muscle consequently the hand withdraws rapidly.
`,
  },
  {
    name: "Homeostasis",
    topic: "Homeostasis",
    topicKey: "aqa-gcse-biology:homeostasis",
    workedExample: `
17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)
Question: Explain how the body responds when core temperature rises during exercise. (4 marks)
1. Thermoreceptors detect rising temperature because core conditions move away from optimum.
2. The hypothalamus acts as a coordination centre therefore it processes the change.
3. Sweat glands release sweat so that evaporation can occur from the skin surface.
4. Evaporation removes heat energy consequently core temperature returns towards optimum.
`,
  },
  {
    name: "The Eye",
    topic: "The eye",
    topicKey: "aqa-gcse-biology:the-eye",
    workedExample: `
17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)
Question: Explain how the eye focuses light onto the retina. (4 marks)
1. Light enters through the cornea because it refracts rays towards the lens.
2. The lens fine-focuses light therefore rays converge on the retina.
3. Photoreceptors detect light so that impulses are sent to the brain.
4. Accommodation changes lens shape consequently near objects stay in focus.
`,
  },
];

function buildTopicLesson({ topic, workedExample }) {
  return `
PAGE 1
1 — REVISION OBJECTIVES
Paste into: Text (concept)
<ul><li>Explain ${topic} using GCSE terminology.</li></ul>
2 — PRIOR KNOWLEDGE
Paste into: Text (concept)
<ul><li>Prior knowledge for ${topic}.</li></ul>
3 — DEFINITION
Paste into: Text (concept)
<p>👉 Core definition for ${topic}.</p>
4 — SCENARIO
Paste into: Hook (text)
<p>👉 Short scenario illustrating ${topic}.</p>
5 — WHY IT MATTERS
Paste into: Text (concept)
<p>👉 Why ${topic} matters in exams.</p>
6 — CORE MODEL
Paste into: Core rule (key idea)
<p>Stimulus → Receptor → Response pathway for ${topic}.</p>
7 — KEY EXAMPLES
Paste into: Text (concept)
<ul><li>Example one</li><li>Example two</li></ul>
8 — EXAM VOCABULARY
Paste into: Text (concept)
<p><strong>Receptor</strong>, <strong>Response</strong></p>
9 — CORE TEACHING
Paste into: Text (concept)
<p>Teaching content for ${topic}.</p>
10 — CHECKPOINT
Paste into: Checkpoint block
Question: Which pathway is correct?
Option 1: Stimulus → Receptor → Response
Option 2: Response → Stimulus
Option 3: Receptor only
Option 4: Effector only
Answer: Stimulus → Receptor → Response
16 — SELF-CHECK QUESTION
Paste into: Self-check question
Question: Which neurone carries impulses to the CNS?
Option 1: Sensory neurone
Option 2: Motor neurone
Option 3: Relay neurone only in glands
Option 4: Effector
Answer: Sensory neurone
Explanation: Sensory neurones carry impulses from receptors to the CNS.
15 — EXAM TECHNIQUE (EXAM SKILL)
Paste into: Exam technique (exam skill)
<p>Exam technique: link mechanism to outcome using because and therefore.</p>
${workedExample}
19 — EXAM PRACTICE
Paste into: Text (concept)
<p><strong>Q1 (1 mark):</strong> What detects a stimulus?</p>
<p><strong>Q2 (2 marks):</strong> Describe the role of motor neurones.</p>
<p><strong>Q3 (3 marks):</strong> Explain impulse travel from receptors to effectors.</p>
<p><strong>Q4 (4 marks):</strong> Explain why quick transmission matters.</p>
<details><summary>Reveal Model Answers</summary>
<p><strong>Q1:</strong> A receptor.</p>
</details>
23 — SUMMARY
Paste into: Text (concept)
<ul><li>Core ideas for ${topic}.</li><li>Link cause to effect.</li></ul>
24 — KEY WORDS
Paste into: Key words
<p><strong>Receptor</strong> – Detects a stimulus.</p>
<p><strong>Stimulus</strong> – A change.</p>
<p><strong>Response</strong> – An action.</p>
<p><strong>Sensory neurone</strong> – To CNS.</p>
<p><strong>Relay neurone</strong> – In CNS.</p>
<p><strong>Motor neurone</strong> – To effector.</p>
<p><strong>Synapse</strong> – Gap.</p>
<p><strong>CNS</strong> – Brain and spinal cord.</p>
<p><strong>PNS</strong> – Peripheral nerves.</p>
<p><strong>Effector</strong> – Muscle or gland.</p>
`.trim();
}

function runGeneratorExportCheck(lessonText, meta) {
  const tmpDir = path.join(root, "backend/scripts/.tmp-acceptance");
  fs.mkdirSync(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, `export-input-${Date.now()}.json`);
  const runnerPath = path.join(root, "backend/scripts/exportCheckRunner.mjs");
  fs.writeFileSync(
    inputPath,
    JSON.stringify({ lessonText, ...meta, title: meta.topic }),
    "utf8"
  );
  try {
    const out = execSync(`node "${runnerPath}" "${inputPath}"`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(out.trim());
  } finally {
    try {
      fs.unlinkSync(inputPath);
    } catch {
      /* ignore */
    }
  }
}

function hasSelfCheckInLesson(text = "") {
  const chunks = String(text || "").split(/\n(?=\d+\s*[—\-–]\s+)/);
  const block = chunks.find((c) => /\bSELF-?CHECK\b/i.test(c));
  if (!block) return false;
  return /Question:/i.test(block) && /Answer:/i.test(block);
}

function runSubprocessTests() {
  const results = [];
  const cmds = [
    { label: "generator-export-pipeline", cmd: `node "${path.join(generatorRoot, "lib/teacherFirstExportPipeline.test.js")}"` },
    { label: "generator-scope", cmd: `node "${path.join(generatorRoot, "lib/scopeAuthorityLite.test.js")}"` },
    { label: "generator-worked-reasoning", cmd: `node "${path.join(generatorRoot, "lib/workedReasoningEngine.test.js")}"` },
    { label: "generator-presentation", cmd: `node "${path.join(generatorRoot, "lib/presentationPolishExport.test.js")}"` },
  ];
  for (const { label, cmd } of cmds) {
    try {
      execSync(cmd, { cwd: generatorRoot, encoding: "utf8", stdio: "pipe" });
      results.push({ label, pass: true });
    } catch (e) {
      results.push({ label, pass: false, error: String(e.stderr || e.stdout || e.message).slice(0, 400) });
    }
  }
  try {
    execSync(`npx jest tests/workedReasoningEngine.test.js tests/teacherFirstExportPipeline.test.js tests/assessmentScopeAuthority.test.js --no-cache`, {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    });
    results.push({ label: "new-repo-jest", pass: true });
  } catch (e) {
    results.push({ label: "new-repo-jest", pass: false, error: String(e.stderr || e.message).slice(0, 400) });
  }
  return results;
}

function evaluateTopic(topicCfg, v2Enabled) {
  process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
  if (v2Enabled) process.env.TEACHER_BRAIN_WORKED_REASONING_V2 = "1";
  else delete process.env.TEACHER_BRAIN_WORKED_REASONING_V2;

  const lessonText = buildTopicLesson(topicCfg);
  const meta = { topic: topicCfg.topic, topicKey: topicCfg.topicKey, subject: "Biology" };
  const profile = resolveTeachingQualityProfile(meta);

  const teachingQuality = evaluateTeachingQualityUpgrade(lessonText, meta);
  const workedScore = scoreWorkedReasoningCoverage(lessonText, profile);

  const { text: fixed } = deterministicAutoFixLesson({ text: lessonText, ...meta });
  const objectivesGate = evaluateObjectivesAuthorityGate(fixed, meta);
  const examPracticeGate = evaluateExamPracticeAuthorityGate(fixed, meta);
  const checkpointGate = evaluateCheckpointAuthorityGate(fixed, meta);
  const exportCheck = runGeneratorExportCheck(fixed, meta);

  const scopePass =
    objectivesGate.pass && examPracticeGate.pass && checkpointGate.pass;
  const exportParityStructural =
    exportCheck.definitionIndex === 2 &&
    exportCheck.scenarioIndex === 3 &&
    exportCheck.hasKeywords &&
    exportCheck.hasSummary &&
    exportCheck.hasWorkedExample &&
    exportCheck.hasExamTechnique &&
    exportCheck.hasExamPractice;
  const selfCheckPopulated =
    hasSelfCheckInLesson(fixed) ||
    exportCheck.hasSelfCheck ||
    (exportCheck.selfCheckKinds || []).length > 0;

  const checklist = {
    A_definitionPresent: exportCheck.definitionIndex >= 0,
    B_definitionBlock3: exportCheck.definitionIndex === 2,
    C_scenarioPresent: exportCheck.scenarioIndex >= 0,
    D_scenarioBlock4: exportCheck.scenarioIndex === 3,
    E_keywordsPopulated: exportCheck.hasKeywords,
    F_summaryPopulated: exportCheck.hasSummary,
    G_scopeAuthority: scopePass,
    H_exportImportParity: exportParityStructural,
    I_selfCheckPopulated: selfCheckPopulated,
    J_workedExamplePopulated: exportCheck.hasWorkedExample,
    K_examTechniquePopulated: exportCheck.hasExamTechnique,
    L_examPracticePopulated: exportCheck.hasExamPractice,
  };

  return {
    topic: topicCfg.name,
    v2Enabled,
    teachingQualityScore: computeTeachingQualityScore(teachingQuality),
    scopeAuthorityScore: [objectivesGate.pass, examPracticeGate.pass, checkpointGate.pass].filter(Boolean)
      .length,
    structureScore: Object.values(checklist).filter(Boolean).length,
    exportImportParityPct: Math.round(
      (Object.values(checklist).filter(Boolean).length / Object.keys(checklist).length) * 100
    ),
    workedReasoningPass: v2Enabled ? workedScore.pass : true,
    checklist,
    allChecklistPass: Object.values(checklist).every(Boolean),
    workedReasoningViolations: workedScore.violations || [],
  };
}

function main() {
  console.log("Phase 3H.1.8b.3a acceptance — Worked Reasoning V2\n");

  const subprocess = runSubprocessTests();
  const subprocessPass = subprocess.every((r) => r.pass);

  const baseline = TOPICS.map((t) => evaluateTopic(t, false));
  const withV2 = TOPICS.map((t) => evaluateTopic(t, true));

  const metricRegression = withV2.every((after, i) => {
    const before = baseline[i];
    return (
      after.teachingQualityScore >= before.teachingQualityScore &&
      after.scopeAuthorityScore >= before.scopeAuthorityScore &&
      after.structureScore >= before.structureScore &&
      after.exportImportParityPct >= before.exportImportParityPct
    );
  });

  const checklistPass = withV2.every((r) => r.allChecklistPass);
  const workedPass = withV2.every((r) => r.workedReasoningPass);
  const parityPass = subprocessPass && withV2.every((r) => r.checklist.H_exportImportParity);
  const overallPass = subprocessPass && checklistPass && workedPass && metricRegression && parityPass;

  const report = {
    phase: "3H.1.8b.3a",
    generatedAt: new Date().toISOString(),
    protectedBaseline: "milestone-teacher-first-v1-recovery",
    preImplementationTag: "milestone-pre-3h18b3a",
    subprocess,
    baseline,
    withV2,
    metricRegression,
    parityPass,
    beforeAfter: withV2.map((after, i) => ({
      topic: after.topic,
      teachingQuality: { before: baseline[i].teachingQualityScore, after: after.teachingQualityScore },
      scopeAuthority: { before: baseline[i].scopeAuthorityScore, after: after.scopeAuthorityScore },
      structure: { before: baseline[i].structureScore, after: after.structureScore },
      exportImportParityPct: { before: baseline[i].exportImportParityPct, after: after.exportImportParityPct },
      workedReasoningPass: after.workedReasoningPass,
    })),
    teacherFirstBaselineIntact: subprocessPass,
    overallPass,
  };

  const reportPath = path.join(root, "backend/scripts/manualAcceptance3H18b3a-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport: ${reportPath}`);
  console.log(overallPass ? "\nPASS — Phase 3H.1.8b.3a accepted." : "\nFAIL — see report for details.");
  process.exit(overallPass ? 0 : 1);
}

main();
