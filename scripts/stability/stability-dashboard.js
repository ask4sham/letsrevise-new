#!/usr/bin/env node
/**
 * Phase 4D — Stability dashboard aggregator.
 *
 * Runs golden tests + production build validation (local build if present)
 * and writes a concise release recommendation.
 *
 * Usage:
 *   node scripts/stability/stability-dashboard.js
 *   node scripts/stability/stability-dashboard.js --url https://letsrevise.com
 *   node scripts/stability/stability-dashboard.js --skip-golden
 */
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

function parseArgs(argv) {
  const out = { url: null, skipGolden: false, skipBuildValidate: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--url") out.url = argv[++i];
    else if (argv[i] === "--skip-golden") out.skipGolden = true;
    else if (argv[i] === "--skip-build-validate") out.skipBuildValidate = true;
  }
  return out;
}

function runNode(scriptRel, args = []) {
  const script = path.join(ROOT, scriptRel);
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
  };
}

function latestReport(prefix) {
  const dir = path.join(ROOT, "docs/stability/reports");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".txt"))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files[0] ? path.join(dir, files[0].f) : null;
}

function main() {
  const args = parseArgs(process.argv);
  const results = {
    golden: null,
    buildValidate: null,
    smoke: null,
  };

  if (!args.skipGolden) {
    console.log("\n=== Golden tests ===\n");
    results.golden = runNode("scripts/stability/run-golden-tests.js");
  } else {
    results.golden = { ok: null, skipped: true };
  }

  const buildDir = path.join(ROOT, "frontend/build");
  const hasBuild = fs.existsSync(path.join(buildDir, "static", "js"));
  if (!args.skipBuildValidate && (hasBuild || args.url)) {
    console.log("\n=== Production build validation ===\n");
    const vArgs = [];
    if (hasBuild) vArgs.push("--build", "frontend/build");
    if (args.url) vArgs.push("--url", args.url);
    results.buildValidate = runNode("scripts/stability/validate-production-build.js", vArgs);
  } else {
    results.buildValidate = {
      ok: null,
      skipped: true,
      reason: hasBuild ? "skipped" : "no frontend/build — run npm run build --prefix frontend first",
    };
  }

  // Smoke is optional here (needs running server); detect latest smoke report if any
  const smokeReport = latestReport("smoke-");
  if (smokeReport) {
    const text = fs.readFileSync(smokeReport, "utf8");
    results.smoke = { ok: /Overall:\s*PASS/i.test(text), report: smokeReport };
  } else {
    results.smoke = { ok: null, skipped: true, reason: "no smoke report — run npm run test:smoke" };
  }

  const knownIssues = [];
  if (results.golden && results.golden.ok === false) knownIssues.push("Golden tests failed");
  if (results.buildValidate && results.buildValidate.ok === false) {
    knownIssues.push("Production build validation failed");
  }
  if (results.smoke && results.smoke.ok === false) knownIssues.push("Browser smoke failed");
  if (results.buildValidate && results.buildValidate.skipped) {
    knownIssues.push(results.buildValidate.reason || "Build validation skipped");
  }
  if (results.smoke && results.smoke.skipped) {
    knownIssues.push(results.smoke.reason || "Smoke skipped");
  }

  const requiredPass =
    (results.golden.skipped || results.golden.ok === true) &&
    (results.buildValidate.skipped || results.buildValidate.ok === true);

  const hardFail =
    results.golden.ok === false || results.buildValidate.ok === false || results.smoke.ok === false;

  let recommendation = "SAFE TO DEPLOY";
  if (hardFail) recommendation = "NOT SAFE — fix failures first";
  else if (results.smoke.skipped || results.buildValidate.skipped) {
    recommendation = "SAFE WITH CAUTION — complete skipped checks before production";
  }

  const fmt = (r) => {
    if (!r || r.skipped) return "SKIP";
    if (r.ok === true) return "PASS";
    if (r.ok === false) return "FAIL";
    return "UNKNOWN";
  };

  const lines = [
    "Stability Dashboard",
    "===================",
    `Generated: ${new Date().toISOString()}`,
    `Baseline tag: production-table-parts-enabled-v1`,
    "",
    `Build validation     ${fmt(results.buildValidate)}`,
    `Unit / golden tests  ${fmt(results.golden)}`,
    `Browser smoke        ${fmt(results.smoke)}`,
    `Feature flags        ${results.buildValidate && results.buildValidate.ok ? "PASS" : results.buildValidate && results.buildValidate.skipped ? "SKIP" : "SEE BUILD REPORT"}`,
    `Production config    ${results.buildValidate && !results.buildValidate.skipped ? fmt(results.buildValidate) : "SKIP"}`,
    "",
    `Known issues`,
    knownIssues.length ? knownIssues.map((i) => `- ${i}`).join("\n") : "- none",
    "",
    `Release recommendation`,
    recommendation,
    "",
    requiredPass && !hardFail
      ? "Note: Prefer running smoke against a live or local server before teacher demos."
      : "",
    "",
  ];

  const text = lines.filter((l, idx, arr) => !(l === "" && arr[idx - 1] === "")).join("\n");
  console.log("\n" + text);

  const outDir = path.join(ROOT, "docs/stability/reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `dashboard-${Date.now()}.txt`);
  fs.writeFileSync(outFile, text, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outFile)}`);

  process.exit(hardFail ? 1 : 0);
}

main();
