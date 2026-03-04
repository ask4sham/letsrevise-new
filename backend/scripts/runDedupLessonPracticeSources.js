/**
 * Cross-platform wrapper for dedupLessonPracticeSources.js.
 * Reads --apply, --spec, --force, --yes, --threshold, --maxLessons from argv and
 * npm_config_specKey / npm_config_speckey from env. In APPLY mode without --force/--yes,
 * requires typing "APPLY ALL" or "APPLY <specKey>" exactly.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const readline = require("readline");

const args = process.argv.slice(2);

const apply = args.includes("--apply");
const force = args.includes("--force") || args.includes("--yes");
const specMode = args.includes("--spec");

const specKey =
  process.env.npm_config_speckey ||
  process.env.npm_config_specKey ||
  null;

function parseOpt(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || !args[idx + 1]) return null;
  return args[idx + 1];
}

let threshold = 0.6;
const thresholdRaw = parseOpt(args, "--threshold");
if (thresholdRaw != null) {
  const t = parseFloat(thresholdRaw, 10);
  if (Number.isFinite(t) && t >= 0 && t <= 1) threshold = t;
}

let maxLessons = null;
const maxLessonsRaw = parseOpt(args, "--maxLessons");
if (maxLessonsRaw != null) {
  const n = parseInt(maxLessonsRaw, 10);
  if (Number.isInteger(n) && n > 0) maxLessons = n;
}

// Stricter: --spec without specKey always aborts (dry run and apply)
if (specMode && !(specKey && String(specKey).trim())) {
  console.error("--spec requires specKey (e.g. npm run ... --specKey=XXX). Aborted.");
  process.exit(2);
}

const scopeLabel = specMode && specKey ? String(specKey).trim() : "ALL";
const required = `APPLY ${scopeLabel}`;

const scriptPath = path.join(__dirname, "dedupLessonPracticeSources.js");
const childArgs = [];

if (apply) childArgs.push("--apply");
if (specMode && specKey) childArgs.push("--specKey", String(specKey).trim());
childArgs.push("--threshold", String(threshold));
if (maxLessons != null) childArgs.push("--maxLessons", String(maxLessons));

function reportPath() {
  const date = new Date().toISOString().slice(0, 10);
  return `reports/DEDUP_LESSON_PRACTICE_${date}.md`;
}

function runScript() {
  console.log("Running dedupLessonPracticeSources");
  console.log("Mode:", apply ? "APPLY" : "DRY RUN");
  console.log("SpecKey:", scopeLabel);
  if (maxLessons != null) console.log("MaxLessons:", maxLessons);

  const result = spawnSync("node", [scriptPath, ...childArgs], {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });

  process.exit(result.status !== null ? result.status : 1);
}

function printSafetySummary() {
  const dbPresent = process.env.MONGODB_URI != null && String(process.env.MONGODB_URI).trim() !== "";
  console.log("");
  console.log("========================================");
  console.log("  APPLY MODE — Safety summary");
  console.log("========================================");
  console.log("  Mode:      APPLY");
  console.log("  Scope:     " + scopeLabel);
  console.log("  Threshold: " + threshold);
  console.log("  Action:    Clear lesson.assessment.questions when overlapRatio >= " + threshold);
  console.log("  Report:    " + reportPath());
  console.log("  DB:        MONGODB_URI present? " + dbPresent);
  if (maxLessons != null) console.log("  MaxLessons: " + maxLessons);
  console.log("========================================");
  console.log("");
  console.log("This will MODIFY the database. To continue, type: APPLY " + scopeLabel);
  console.log("");
}

function promptConfirm(cb) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("> ", (answer) => {
    rl.close();
    const trimmed = answer ? String(answer).trim() : "";
    if (trimmed === required) {
      cb();
    } else {
      console.log("Aborted. Expected: " + required);
      process.exit(2);
    }
  });
}

function main() {
  if (apply && !force) {
    printSafetySummary();
    promptConfirm(runScript);
  } else {
    runScript();
  }
}

main();
