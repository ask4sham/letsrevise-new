#!/usr/bin/env node
/**
 * Phase 4A — Golden regression test runner (targeted suites only; avoids full-suite OOM).
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "../..");

const FRONTEND_TESTS = [
  "ExamQuestionBlock.test.tsx",
  "ExamQuestionBlock.table.test.tsx",
  "ExamQuestionBlock.tableFlagOff.test.tsx",
  "AnswerFeedbackPanel.test.tsx",
  "QuizView.test.tsx",
  "LessonViewPage.practiceMarking.test.ts",
  "revisionPracticeVariants.test.ts",
  "registry.table.test.ts",
  "compositeMarkingReadiness.test.ts",
  "TableRenderer.test.tsx",
];

const BACKEND_TESTS = [
  "tests/compositeExamQuestion.table.unit.test.js",
  "tests/normalizeLessonTopicKey.unit.test.js",
  "tests/resolveLessonTopicKeyForAttach.unit.test.js",
  "tests/taxonomy.createLessonOptions.test.js",
  "tests/taxonomy.edexcelIgcseBiology.integration.test.js",
];

function run(cmd, args, cwd, envOverrides = null) {
  console.log(`\n> ${cmd} ${args.join(" ")}\n`);
  const env = envOverrides
    ? { ...envOverrides, CI: "true" }
    : { ...process.env, CI: "true" };
  const r = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return r.status === 0;
}

function main() {
  // Unset local table override so flag-OFF suite is not polluted by .env.local
  const feEnv = { ...process.env, CI: "true" };
  delete feEnv.REACT_APP_TABLE_PARTS_ENABLED;

  const feOk = run(
    "npx",
    ["react-scripts", "test", "--watchAll=false", ...FRONTEND_TESTS],
    path.join(ROOT, "frontend"),
    feEnv
  );

  const beOk = run(
    "npx",
    ["jest", ...BACKEND_TESTS, "--no-coverage", "--runInBand"],
    path.join(ROOT, "backend")
  );

  const lines = [
    "Golden Regression Report",
    "========================",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Frontend golden: ${feOk ? "PASS" : "FAIL"}`,
    `Backend golden:  ${beOk ? "PASS" : "FAIL"}`,
    "",
    `Overall: ${feOk && beOk ? "PASS" : "FAIL"}`,
    "",
  ];
  const text = lines.join("\n");
  console.log(text);

  const outDir = path.join(ROOT, "docs/stability/reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `golden-${Date.now()}.txt`);
  fs.writeFileSync(outFile, text, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outFile)}`);

  process.exit(feOk && beOk ? 0 : 1);
}

main();
