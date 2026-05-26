#!/usr/bin/env node
/**
 * Build oxygen-debt exam diagram SVG (match-panel / teaching asset).
 * Usage: node visual-templates/scripts/build-oxygen-debt-diagram.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(ROOT, "..");
const { renderOxygenDebtExamDiagram } = require("../engines/process-diagram/oxygenDebtExamDiagram");

const brand = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tokens/letsrevise-brand.json"), "utf8")
);

const outDir = path.join(
  REPO_ROOT,
  "backend/public/visuals/biology/aqa-gcse/bioenergetics/oxygen-debt/lr-oxygen-debt-exam-v1"
);
const outFile = path.join(outDir, "oxygen-debt-exam-diagram.svg");

fs.mkdirSync(outDir, { recursive: true });
const svg = renderOxygenDebtExamDiagram(brand);
fs.writeFileSync(outFile, svg, "utf8");
console.log(`Wrote ${outFile}`);
