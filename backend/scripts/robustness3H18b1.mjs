/**
 * Phase 3H.1.8b.1 robustness — 15 generations (5× NS, 5× Homeostasis, 5× Eye).
 * Usage: node backend/scripts/robustness3H18b1.mjs
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const require = createRequire(import.meta.url);

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const RUNS_PER_TOPIC = 5;

/** Sibling-topic drift terms per lesson family (downstream + objectives framing). */
const TOPIC_CONFIGS = [
  {
    id: "nervous-system",
    label: "Structure and function of the nervous system",
    topic: "Structure and function of the nervous system",
    topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
    driftTerms: [
      "cerebellum",
      "cortex",
      "medulla",
      "thermoregulation",
      "hypothalamus",
      "accommodation",
      "retina",
      "iris",
      "pupil",
      "lens",
      "vasodilation",
      "vasoconstriction",
      "sweating",
      "shivering",
    ],
  },
  {
    id: "homeostasis",
    label: "Homeostasis",
    topic: "Homeostasis",
    topicKey: "aqa-gcse-biology:homeostasis",
    driftTerms: [
      "cerebellum",
      "cerebral cortex",
      "medulla",
      "accommodation",
      "cornea",
      "reflex arc",
      "synapse",
      "myelin sheath",
      "motor neurone",
      "sensory neurone",
    ],
  },
  {
    id: "eye",
    label: "The eye",
    topic: "The eye",
    topicKey: "aqa-gcse-biology:the-eye",
    driftTerms: [
      "thermoregulation",
      "hypothalamus",
      "vasodilation",
      "vasoconstriction",
      "sweating",
      "shivering",
      "cerebellum",
      "medulla",
      "myelin sheath",
      "synapse",
      "reflex arc",
    ],
  },
];

function findDriftTerms(text, termList) {
  const hay = String(text || "").toLowerCase();
  return termList.filter((t) => hay.includes(t.toLowerCase()));
}

function extractSection(text, headingRe) {
  const lines = String(text || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i]) && headingRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function objectivesFramingHaystack(text, oa) {
  return [
    oa.extractLessonObjectiveField(text),
    oa.extractShortSummaryField?.(text) ?? "",
    oa.extractObjectivesBlockText(text),
    oa.extractPriorKnowledgeBlockText(text),
  ]
    .filter(Boolean)
    .join("\n");
}

function scanLessonDrift(text, cfg, oa, findClosingDriftTermsInText) {
  const framing = objectivesFramingHaystack(text, oa);
  const checkpoints = [
    extractSection(text, /\bCHECKPOINT\b/i),
    extractSection(text, /\bQUICK\s+CHECK\b/i),
    extractSection(text, /\bDRAG\s+AND\s+DROP\b/i),
  ].join("\n");
  const examPractice = extractSection(text, /\bEXAM\s+PRACTICE\b/i);
  const summary = extractSection(text, /\bSUMMARY\b/i);
  const memoryRule = extractSection(text, /\bFINAL\s+MEMORY\s+RULE\b|\bKEY\s+INSIGHT\b/i);

  const objectivesGate = oa.evaluateObjectivesAuthorityGate(text, {
    topic: cfg.topic,
    topicKey: cfg.topicKey,
    subTopic: cfg.topic,
  });

  const framingDrift = findDriftTerms(framing, cfg.driftTerms);
  const objectivesGatePass =
    cfg.id === "nervous-system"
      ? objectivesGate.pass && framingDrift.length === 0
      : framingDrift.length === 0 && objectivesGate.violations.length === 0;

  const summaryDriftTerms =
    cfg.id === "nervous-system" && findClosingDriftTermsInText
      ? findClosingDriftTermsInText(summary)
      : findDriftTerms(summary, cfg.driftTerms);

  const memoryRuleDriftTerms =
    cfg.id === "nervous-system" && findClosingDriftTermsInText
      ? findClosingDriftTermsInText(memoryRule)
      : findDriftTerms(memoryRule, cfg.driftTerms);

  const downstreamDriftTerms = [
    ...findDriftTerms(checkpoints, cfg.driftTerms),
    ...findDriftTerms(examPractice, cfg.driftTerms),
    ...summaryDriftTerms,
    ...memoryRuleDriftTerms,
  ];
  const uniqueDownstream = [...new Set(downstreamDriftTerms)];

  return {
    objectivesGatePass,
    objectivesGate,
    framingDriftCount: framingDrift.length,
    framingDriftTerms: framingDrift,
    checkpointDriftCount: findDriftTerms(checkpoints, cfg.driftTerms).length,
    checkpointDriftTerms: findDriftTerms(checkpoints, cfg.driftTerms),
    examPracticeDriftCount: findDriftTerms(examPractice, cfg.driftTerms).length,
    examPracticeDriftTerms: findDriftTerms(examPractice, cfg.driftTerms),
    summaryDriftCount: summaryDriftTerms.length,
    summaryDriftTerms,
    memoryRuleDriftCount: memoryRuleDriftTerms.length,
    memoryRuleDriftTerms,
    totalDownstreamDrift: uniqueDownstream.length,
    lessonClean: objectivesGatePass && uniqueDownstream.length === 0,
  };
}

async function callOpenAiSs1(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing in backend/.env");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: prompt }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || JSON.stringify(data));
  if (typeof data?.output_text === "string") return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (c.type === "output_text" && c.text) parts.push(c.text);
    }
  }
  return parts.join("\n");
}

function excerptAroundTerm(text, term, radius = 200) {
  const hay = String(text || "");
  const idx = hay.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(hay.length, idx + term.length + radius);
  return hay.slice(start, end).replace(/\s+/g, " ").trim();
}

async function generateOne(cfg, runIndex, deps) {
  const { buildPrompt, deterministicAutoFixLesson, oa, findClosingDriftTermsInText } = deps;
  const prompt = buildPrompt({
    subject: "Biology",
    keyStage: "KS4 - GCSE",
    examBoard: "AQA",
    topic: cfg.topic,
    topicKey: cfg.topicKey,
    subTopic: cfg.topic,
    tier: "Higher Tier",
  });

  const t0 = Date.now();
  let raw;
  let apiError = null;
  try {
    raw = await callOpenAiSs1(prompt);
  } catch (err) {
    apiError = String(err.message || err);
    return { cfg, runIndex, apiError, lessonClean: false };
  }

  const before = scanLessonDrift(raw, cfg, oa, findClosingDriftTermsInText);

  const { text: fixed, objectivesGate, checkpointGate, examPracticeGate, summaryGate, memoryRuleGate, fixesApplied } =
    deterministicAutoFixLesson({
      text: raw,
      subject: "Biology",
      topic: cfg.topic,
      topicKey: cfg.topicKey,
    });

  const after = scanLessonDrift(fixed, cfg, oa, findClosingDriftTermsInText);

  return {
    cfg: { id: cfg.id, label: cfg.label, topicKey: cfg.topicKey },
    runIndex,
    generationSeconds: ((Date.now() - t0) / 1000).toFixed(1),
    promptHasObjectivesMandate: prompt.includes("MANDATORY OBJECTIVES"),
    promptHasCheckpointMandate: prompt.includes("MANDATORY CHECKPOINTS"),
    promptHasExamPracticeMandate: prompt.includes("MANDATORY EXAM PRACTICE"),
    promptHasSummaryMandate: prompt.includes("MANDATORY SUMMARY"),
    promptHasMemoryRuleMandate: prompt.includes("MANDATORY MEMORY RULE"),
    scopeFixesApplied: fixesApplied.filter((f) =>
      /Objectives scope authority|Checkpoint authority|Exam Practice authority|Summary authority|Memory Rule authority/i.test(f)
    ),
    before,
    after,
    objectivesGateFromAutofix: objectivesGate,
    checkpointGateFromAutofix: checkpointGate,
    examPracticeGateFromAutofix: examPracticeGate,
    summaryGateFromAutofix: summaryGate,
    memoryRuleGateFromAutofix: memoryRuleGate,
    raw,
    fixed,
    lessonClean: after.lessonClean,
  };
}

function aggregateResults(results) {
  const completed = results.filter((r) => !r.apiError);
  const failures = completed.filter((r) => !r.lessonClean);
  const byTopic = {};
  for (const cfg of TOPIC_CONFIGS) {
    const topicRuns = completed.filter((r) => r.cfg.id === cfg.id);
    byTopic[cfg.id] = {
      label: cfg.label,
      runs: topicRuns.length,
      clean: topicRuns.filter((r) => r.lessonClean).length,
      objectivesGatePass: topicRuns.filter((r) => r.after.objectivesGatePass).length,
      anyDownstreamDrift: topicRuns.filter((r) => r.after.totalDownstreamDrift > 0).length,
    };
  }

  return {
    totalPlanned: TOPIC_CONFIGS.length * RUNS_PER_TOPIC,
    totalCompleted: completed.length,
    apiErrors: results.filter((r) => r.apiError).length,
    lessonCleanCount: completed.filter((r) => r.lessonClean).length,
    lessonCleanPassRate: completed.length
      ? Math.round((completed.filter((r) => r.lessonClean).length / completed.length) * 100)
      : 0,
    objectivesGatePassCount: completed.filter((r) => r.after.objectivesGatePass).length,
    objectivesGatePassRate: completed.length
      ? Math.round(
          (completed.filter((r) => r.after.objectivesGatePass).length / completed.length) * 100
        )
      : 0,
    byTopic,
    failures: failures.map((r) => ({
      topic: r.cfg.label,
      runIndex: r.runIndex,
      after: {
        objectivesGatePass: r.after.objectivesGatePass,
        framingDriftTerms: r.after.framingDriftTerms,
        checkpointDriftTerms: r.after.checkpointDriftTerms,
        examPracticeDriftTerms: r.after.examPracticeDriftTerms,
        summaryDriftTerms: r.after.summaryDriftTerms,
        memoryRuleDriftTerms: r.after.memoryRuleDriftTerms,
      },
      excerpts: collectFailureExcerpts(r.fixed, r.after, TOPIC_CONFIGS.find((c) => c.id === r.cfg.id)),
    })),
    intermittency: analyzeIntermittency(completed),
  };
}

function collectFailureExcerpts(text, after, cfg) {
  const excerpts = {};
  const allTerms = [
    ...after.framingDriftTerms,
    ...after.checkpointDriftTerms,
    ...after.examPracticeDriftTerms,
    ...after.summaryDriftTerms,
    ...after.memoryRuleDriftTerms,
  ];
  for (const term of [...new Set(allTerms)]) {
    excerpts[term] = excerptAroundTerm(text, term);
  }
  return excerpts;
}

function analyzeIntermittency(completed) {
  const byTopic = {};
  for (const cfg of TOPIC_CONFIGS) {
    const runs = completed.filter((r) => r.cfg.id === cfg.id);
    const cleanFlags = runs.map((r) => r.lessonClean);
    const driftCounts = runs.map((r) => r.after.totalDownstreamDrift);
    byTopic[cfg.id] = {
      cleanRuns: cleanFlags.filter(Boolean).length,
      dirtyRuns: cleanFlags.filter((c) => !c).length,
      intermittent:
        cleanFlags.some(Boolean) && cleanFlags.some((c) => !c),
      driftCountsPerRun: driftCounts,
    };
  }
  return byTopic;
}

async function main() {
  process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
  process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
  process.env.TEACHER_BRAIN_OBJECTIVES_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_CHECKPOINT_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_EXAM_PRACTICE_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_SUMMARY_AUTHORITY = "1";
  process.env.TEACHER_BRAIN_MEMORY_RULE_AUTHORITY = "1";

  const { buildPrompt } = await import("../../lib/buildPrompt.js");
  const { deterministicAutoFixLesson } = await import("../../lib/deterministicAutoFixLesson.js");
  const oa = require("../../lib/teacherBrain/objectivesAuthority.js");
  const { findClosingDriftTermsInText } = require("../../lib/teacherBrain/closingScopeUtils.js");

  const outDir = path.join(root, "docs", "design", "validation", "3H18b1-robustness-step2b");
  fs.mkdirSync(outDir, { recursive: true });

  const deps = { buildPrompt, deterministicAutoFixLesson, oa, findClosingDriftTermsInText };
  const results = [];
  let runNum = 0;

  for (const cfg of TOPIC_CONFIGS) {
    for (let i = 1; i <= RUNS_PER_TOPIC; i++) {
      runNum += 1;
      console.log(`\n[${runNum}/15] ${cfg.label} — run ${i}/${RUNS_PER_TOPIC}…`);
      const result = await generateOne(cfg, i, deps);
      results.push(result);

      if (result.apiError) {
        console.log(`  API ERROR: ${result.apiError}`);
        continue;
      }

      const slug = `${cfg.id}-run${i}`;
      fs.writeFileSync(path.join(outDir, `${slug}-raw.txt`), result.raw, "utf8");
      fs.writeFileSync(path.join(outDir, `${slug}-fixed.txt`), result.fixed, "utf8");

      console.log(
        `  clean=${result.lessonClean} objGate=${result.after.objectivesGatePass} downstreamDrift=${result.after.totalDownstreamDrift} (${result.generationSeconds}s)`
      );
      if (!result.lessonClean) {
        console.log(`  drift: framing=[${result.after.framingDriftTerms}] cp=[${result.after.checkpointDriftTerms}] exam=[${result.after.examPracticeDriftTerms}] sum=[${result.after.summaryDriftTerms}] mem=[${result.after.memoryRuleDriftTerms}]`);
      }
    }
  }

  const summary = aggregateResults(results);

  const step2aBaselinePath = path.join(
    root,
    "docs",
    "design",
    "validation",
    "3H18b1-robustness-step2a",
    "robustness-report.json"
  );
  let step2aBaseline = null;
  if (fs.existsSync(step2aBaselinePath)) {
    try {
      step2aBaseline = JSON.parse(fs.readFileSync(step2aBaselinePath, "utf8"));
    } catch {
      step2aBaseline = null;
    }
  }

  const nsRuns = results.filter((r) => r.cfg?.id === "nervous-system" && !r.apiError);
  const nsMemoryRuleDriftAfter = nsRuns.filter((r) => r.after.memoryRuleDriftCount > 0).length;
  const nsSummaryDriftAfter = nsRuns.filter((r) => r.after.summaryDriftCount > 0).length;
  const nsCheckpointDriftAfter = nsRuns.filter((r) => r.after.checkpointDriftCount > 0).length;
  const nsExamDriftAfter = nsRuns.filter((r) => r.after.examPracticeDriftCount > 0).length;

  const report = {
    phase: "3H.1.8b.2b",
    generatedAt: new Date().toISOString(),
    flags: {
      TEACHER_BRAIN_TEACHER_FIRST_OPENING: "1",
      TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE: "1",
      TEACHER_BRAIN_SUBTOPIC_BOUNDARY: "2",
      TEACHER_BRAIN_OBJECTIVES_AUTHORITY: "1",
      TEACHER_BRAIN_CHECKPOINT_AUTHORITY: "1",
      TEACHER_BRAIN_EXAM_PRACTICE_AUTHORITY: "1",
      TEACHER_BRAIN_SUMMARY_AUTHORITY: "1",
      TEACHER_BRAIN_MEMORY_RULE_AUTHORITY: "1",
    },
    runsPerTopic: RUNS_PER_TOPIC,
    topicDriftDefinitions: TOPIC_CONFIGS.map((c) => ({
      id: c.id,
      label: c.label,
      driftTerms: c.driftTerms,
    })),
    summary,
    nsAuthorityChecks: {
      memoryRuleDriftRuns: nsMemoryRuleDriftAfter,
      summaryDriftRuns: nsSummaryDriftAfter,
      checkpointDriftRuns: nsCheckpointDriftAfter,
      examPracticeDriftRuns: nsExamDriftAfter,
    },
    comparisonToStep2a: step2aBaseline
      ? {
          step2aPhase: step2aBaseline.phase,
          step2aLessonCleanPassRate: step2aBaseline.summary?.lessonCleanPassRate,
          step2aByTopic: step2aBaseline.summary?.byTopic,
          step2bLessonCleanPassRate: summary.lessonCleanPassRate,
          step2bByTopic: summary.byTopic,
          deltaOverallCleanRate:
            summary.lessonCleanPassRate - (step2aBaseline.summary?.lessonCleanPassRate || 0),
          deltaNervousSystemClean:
            (summary.byTopic["nervous-system"]?.clean || 0) -
            (step2aBaseline.summary?.byTopic?.["nervous-system"]?.clean || 0),
        }
      : null,
    runs: results.map((r) => ({
      topic: r.cfg?.label,
      topicId: r.cfg?.id,
      runIndex: r.runIndex,
      apiError: r.apiError || null,
      generationSeconds: r.generationSeconds,
      lessonClean: r.lessonClean,
      before: r.before
        ? {
            objectivesGatePass: r.before.objectivesGatePass,
            framingDriftCount: r.before.framingDriftCount,
            checkpointDriftCount: r.before.checkpointDriftCount,
            examPracticeDriftCount: r.before.examPracticeDriftCount,
            summaryDriftCount: r.before.summaryDriftCount,
            memoryRuleDriftCount: r.before.memoryRuleDriftCount,
          }
        : null,
      after: r.after
        ? {
            objectivesGatePass: r.after.objectivesGatePass,
            framingDriftCount: r.after.framingDriftCount,
            framingDriftTerms: r.after.framingDriftTerms,
            checkpointDriftCount: r.after.checkpointDriftCount,
            checkpointDriftTerms: r.after.checkpointDriftTerms,
            examPracticeDriftCount: r.after.examPracticeDriftCount,
            examPracticeDriftTerms: r.after.examPracticeDriftTerms,
            summaryDriftCount: r.after.summaryDriftCount,
            summaryDriftTerms: r.after.summaryDriftTerms,
            memoryRuleDriftCount: r.after.memoryRuleDriftCount,
            memoryRuleDriftTerms: r.after.memoryRuleDriftTerms,
            totalDownstreamDrift: r.after.totalDownstreamDrift,
          }
        : null,
      scopeFixesApplied: r.scopeFixesApplied,
      artifactFixed: r.cfg
        ? `docs/design/validation/3H18b1-robustness-step2b/${r.cfg.id}-run${r.runIndex}-fixed.txt`
        : null,
    })),
  };

  fs.writeFileSync(path.join(outDir, "robustness-report.json"), JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(
    path.join(root, "backend", "scripts", "robustness3H18b1-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log("\n=== ROBUSTNESS SUMMARY ===");
  console.log(`Completed: ${summary.totalCompleted}/${summary.totalPlanned}`);
  console.log(`Lesson clean pass rate: ${summary.lessonCleanPassRate}% (${summary.lessonCleanCount}/${summary.totalCompleted})`);
  console.log(`Objectives gate pass rate: ${summary.objectivesGatePassRate}%`);
  console.log(`Failures: ${summary.failures.length}`);
  if (report.comparisonToStep2a) {
    const c = report.comparisonToStep2a;
    console.log(`Step 2a → Step 2b overall clean: ${c.step2aLessonCleanPassRate}% → ${c.step2bLessonCleanPassRate}% (Δ${c.deltaOverallCleanRate})`);
    console.log(`NS clean: ${c.step2aByTopic["nervous-system"]?.clean}/5 → ${c.step2bByTopic["nervous-system"]?.clean}/5 (Δ${c.deltaNervousSystemClean})`);
  }
  console.log(`NS memory rule drift runs: ${report.nsAuthorityChecks.memoryRuleDriftRuns}/5`);
  console.log(`NS summary drift runs: ${report.nsAuthorityChecks.summaryDriftRuns}/5`);
  console.log(`Report: ${path.join(outDir, "robustness-report.json")}`);

  const nsClean = summary.byTopic["nervous-system"]?.clean || 0;
  const nsPass = nsClean === RUNS_PER_TOPIC;
  const homeoPass = (summary.byTopic.homeostasis?.clean || 0) === RUNS_PER_TOPIC;
  const eyePass = (summary.byTopic.eye?.clean || 0) === RUNS_PER_TOPIC;
  const memPass = report.nsAuthorityChecks.memoryRuleDriftRuns === 0;
  const sumPass = report.nsAuthorityChecks.summaryDriftRuns === 0;
  const cpPass = report.nsAuthorityChecks.checkpointDriftRuns === 0;
  const examPass = report.nsAuthorityChecks.examPracticeDriftRuns === 0;
  const acceptancePass = nsPass && homeoPass && eyePass && memPass && sumPass && cpPass && examPass;

  console.log(`Acceptance: NS5/5=${nsPass} Mem0/5=${memPass} Sum5/5=${sumPass} Cp0=${cpPass} Exam0=${examPass} Homeo=${homeoPass} Eye=${eyePass} → ${acceptancePass ? "PASS" : "FAIL"}`);

  process.exit(acceptancePass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
