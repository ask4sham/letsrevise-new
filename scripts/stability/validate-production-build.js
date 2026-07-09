#!/usr/bin/env node
/**
 * Phase 4B — Production build / live bundle validation.
 *
 * Usage:
 *   node scripts/stability/validate-production-build.js --build frontend/build
 *   node scripts/stability/validate-production-build.js --url https://letsrevise.com
 *   node scripts/stability/validate-production-build.js --build frontend/build --url https://letsrevise.com
 *
 * Exit 0 = all required checks pass; exit 1 = one or more required checks fail.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ROOT = path.resolve(__dirname, "../..");

function parseArgs(argv) {
  const out = { build: null, url: null, outFile: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--build") out.build = argv[++i];
    else if (a === "--url") out.url = argv[++i];
    else if (a === "--out") out.outFile = argv[++i];
  }
  return out;
}

function get(url) {
  const lib = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    lib
      .get(url, { timeout: 30000 }, (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") })
        );
      })
      .on("error", reject);
  });
}

function findMainBundle(buildDir) {
  const jsDir = path.join(buildDir, "static", "js");
  if (!fs.existsSync(jsDir)) return null;
  const file = fs.readdirSync(jsDir).find((f) => /^main\.[a-z0-9]+\.js$/.test(f));
  return file ? path.join(jsDir, file) : null;
}

function analyzeBundle(jsText, label) {
  const checks = [];
  const envTable = jsText.match(/REACT_APP_TABLE_PARTS_ENABLED:"([^"]*)"/);
  const tableOn =
    (envTable && envTable[1] === "true") || jsText.includes("TABLE_PARTS_ENABLED:!0");
  const tableOffLiteral = jsText.includes("TABLE_PARTS_ENABLED:!1") && !tableOn;

  checks.push({
    id: "table_renderer_code",
    label: "Table renderer present",
    pass: jsText.includes("exam-composite-table-input"),
    required: true,
  });
  checks.push({
    id: "table_flag_on",
    label: "Table feature flag enabled",
    pass: tableOn,
    required: true,
    detail: envTable ? `REACT_APP_TABLE_PARTS_ENABLED=${envTable[1]}` : tableOffLiteral ? "default false" : "unknown",
  });
  checks.push({
    id: "reveal_gating",
    label: "Reveal gating present",
    pass: jsText.includes("exam-composite-reveal-btn"),
    required: true,
  });
  checks.push({
    id: "check_all",
    label: "Composite Check answer present",
    pass: jsText.includes("exam-composite-check-all-btn"),
    required: true,
  });
  checks.push({
    id: "composite_shell",
    label: "Composite questions present",
    pass: jsText.includes("exam-composite") || jsText.includes("exam-question-block--composite"),
    required: true,
  });

  const apiUrl = jsText.match(/REACT_APP_API_URL:"([^"]*)"/);
  const apiBase = jsText.match(/REACT_APP_API_BASE:"([^"]*)"/);
  checks.push({
    id: "api_url",
    label: "API URL configured",
    pass: Boolean((apiUrl && apiUrl[1]) || (apiBase && apiBase[1])),
    required: true,
    detail: (apiUrl && apiUrl[1]) || (apiBase && apiBase[1]) || "(absent)",
  });

  const hasSupabase =
    /REACT_APP_SUPABASE_URL:"[^"]+"/.test(jsText) ||
    /REACT_APP_SUPABASE_ANON_KEY:"[^"]+"/.test(jsText);
  checks.push({
    id: "supabase",
    label: "Supabase env present",
    pass: hasSupabase,
    required: false,
    detail: hasSupabase ? "present" : "not found in bundle (may be runtime-only)",
  });

  return { label, checks, tableOn, apiUrl: apiUrl && apiUrl[1], apiBase: apiBase && apiBase[1] };
}

async function analyzeLive(url) {
  const home = await get(url.replace(/\/$/, "") + "/");
  const m = home.body.match(/static\/js\/main\.([a-z0-9]+)\.js/);
  if (!m) {
    return {
      label: url,
      checks: [{ id: "bundle", label: "Main bundle found", pass: false, required: true }],
      bundleHash: null,
    };
  }
  const hash = m[1];
  const jsUrl = `${url.replace(/\/$/, "")}/static/js/main.${hash}.js`;
  const js = await get(jsUrl);
  const analyzed = analyzeBundle(js.body, `live:${url} (main.${hash}.js)`);
  analyzed.bundleHash = hash;

  try {
    const health = await get(`${url.replace(/\/$/, "")}/api/health`);
    const ok = health.status === 200 && /OK|ok|running/i.test(health.body);
    let commit = null;
    try {
      commit = JSON.parse(health.body).commit || null;
    } catch (_) {
      /* ignore */
    }
    analyzed.checks.push({
      id: "api_health",
      label: "API health reachable",
      pass: ok,
      required: true,
      detail: commit ? `commit=${commit}` : `status=${health.status}`,
    });
  } catch (e) {
    analyzed.checks.push({
      id: "api_health",
      label: "API health reachable",
      pass: false,
      required: true,
      detail: String(e.message || e),
    });
  }

  return analyzed;
}

function analyzeBuildDir(buildRel) {
  const buildDir = path.isAbsolute(buildRel) ? buildRel : path.join(ROOT, buildRel);
  const mainPath = findMainBundle(buildDir);
  if (!mainPath) {
    return {
      label: buildDir,
      checks: [{ id: "bundle", label: "Main bundle built", pass: false, required: true }],
    };
  }
  const jsText = fs.readFileSync(mainPath, "utf8");
  const analyzed = analyzeBundle(jsText, `build:${path.relative(ROOT, mainPath)}`);
  analyzed.bundleHash = path.basename(mainPath);
  analyzed.checks.unshift({
    id: "bundle",
    label: "Main bundle built",
    pass: true,
    required: true,
    detail: path.basename(mainPath),
  });
  return analyzed;
}

function formatReport(sections) {
  const lines = [];
  lines.push("Production Build Report");
  lines.push("=======================");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  let requiredFail = 0;
  let optionalFail = 0;

  for (const section of sections) {
    lines.push(`## ${section.label}`);
    if (section.bundleHash) lines.push(`Bundle: ${section.bundleHash}`);
    for (const c of section.checks) {
      const mark = c.pass ? "✓" : "✗";
      const req = c.required ? "" : " (optional)";
      lines.push(`${mark} ${c.label}${req}${c.detail ? ` — ${c.detail}` : ""}`);
      if (!c.pass) {
        if (c.required) requiredFail += 1;
        else optionalFail += 1;
      }
    }
    lines.push("");
  }

  const recommendation =
    requiredFail === 0 ? "SAFE TO DEPLOY (required checks)" : "NOT SAFE — fix required failures";
  lines.push("Summary");
  lines.push("-------");
  lines.push(`Required failures: ${requiredFail}`);
  lines.push(`Optional failures: ${optionalFail}`);
  lines.push(`Release recommendation: ${recommendation}`);
  lines.push("");
  return { text: lines.join("\n"), requiredFail };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.build && !args.url) {
    console.error(
      "Usage: node scripts/stability/validate-production-build.js --build frontend/build [--url https://letsrevise.com]"
    );
    process.exit(2);
  }

  const sections = [];
  if (args.build) sections.push(analyzeBuildDir(args.build));
  if (args.url) sections.push(await analyzeLive(args.url));

  const { text, requiredFail } = formatReport(sections);
  console.log(text);

  const outFile =
    args.outFile ||
    path.join(ROOT, "docs/stability/reports", `production-build-${Date.now()}.txt`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, text, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outFile)}`);

  process.exit(requiredFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
