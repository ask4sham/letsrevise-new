#!/usr/bin/env node
/**
 * Phase 4C — Playwright smoke wrapper + report file.
 */
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const FE = path.join(ROOT, "frontend");

function main() {
  const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
  console.log(`Smoke base URL: ${base}`);

  const install = spawnSync("npx", ["playwright", "install", "chromium"], {
    cwd: FE,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (install.status !== 0) {
    console.error("playwright install failed (continuing if browsers already present)");
  }

  const r = spawnSync("npx", ["playwright", "test"], {
    cwd: FE,
    env: { ...process.env, SMOKE_BASE_URL: base },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const ok = r.status === 0;
  const lines = [
    "Browser Smoke Report",
    "====================",
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${base}`,
    "",
    `Overall: ${ok ? "PASS" : "FAIL"}`,
    "",
  ];
  const text = lines.join("\n");
  console.log(text);

  const outDir = path.join(ROOT, "docs/stability/reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `smoke-${Date.now()}.txt`);
  fs.writeFileSync(outFile, text, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outFile)}`);

  process.exit(ok ? 0 : 1);
}

main();
