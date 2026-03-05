/**
 * PR-011: Generate SPRINT_ORDER markdown from CoverageSnapshot + weak-evidence.
 * Delegates to sprintOrderService (PR-012); script is a thin CLI wrapper.
 *
 * Usage (from backend/):
 *   node scripts/buildSprintOrderFromCoverage.js --specKey aqa-gcse-biology
 *   node scripts/buildSprintOrderFromCoverage.js --specKey aqa-gcse-biology --apply
 *
 * Windows PowerShell (from project root):
 *   cd backend; node scripts/buildSprintOrderFromCoverage.js --specKey aqa-gcse-biology
 *
 * Or use npm (from backend/):
 *   npm run maintenance:sprint-order --specKey=aqa-gcse-biology
 */
const path = require("path");
const fs = require("fs");
const readline = require("readline");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { buildSprintOrderMarkdown, loadSnapshots, specKeyDisplay } = require("../services/sprintOrder/sprintOrderService");
const { normalizeSpecKey } = require("../config/featureFlags");

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const specKeyIdx = args.indexOf("--specKey");
  const specKey = specKeyIdx !== -1 && args[specKeyIdx + 1] ? String(args[specKeyIdx + 1]).trim() : null;

  let windowDays = 14;
  const winIdx = args.indexOf("--windowDays");
  if (winIdx !== -1 && args[winIdx + 1]) {
    const n = parseInt(args[winIdx + 1], 10);
    if (Number.isInteger(n) && n > 0) windowDays = n;
  }

  let useSnapshots = true;
  const snapIdx = args.indexOf("--useSnapshots");
  if (snapIdx !== -1 && args[snapIdx + 1]) {
    const v = String(args[snapIdx + 1]).toLowerCase();
    useSnapshots = v === "true" || v === "1" || v === "yes";
  }

  let top = 200;
  const topIdx = args.indexOf("--top");
  if (topIdx !== -1 && args[topIdx + 1]) {
    const n = parseInt(args[topIdx + 1], 10);
    if (Number.isInteger(n) && n > 0) top = n;
  }

  let minEnquiries = 3;
  const minIdx = args.indexOf("--minEnquiries");
  if (minIdx !== -1 && args[minIdx + 1]) {
    const n = parseInt(args[minIdx + 1], 10);
    if (Number.isInteger(n) && n >= 0) minEnquiries = n;
  }

  let coverageWeight = 0.65;
  let weakWeight = 0.35;
  let demandWeight = 0;
  const weightsIdx = args.indexOf("--weights");
  if (weightsIdx !== -1 && args[weightsIdx + 1]) {
    const s = String(args[weightsIdx + 1]);
    const m1 = s.match(/coverage=([\d.]+)/);
    const m2 = s.match(/weak=([\d.]+)/);
    const m3 = s.match(/demand=([\d.]+)/);
    if (m1) coverageWeight = parseFloat(m1[1]) || 0.65;
    if (m2) weakWeight = parseFloat(m2[1]) || 0.35;
    if (m3) demandWeight = parseFloat(m3[1]) || 0;
  }

  return { apply, specKey, windowDays, useSnapshots, top, minEnquiries, coverageWeight, weakWeight, demandWeight };
}

function promptApplyConfirmation(displayKey) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("");
    console.log("========================================");
    console.log("  APPLY MODE — No snapshots found");
    console.log("========================================");
    console.log("  Will compute coverage and write CoverageSnapshot rows.");
    console.log("  To continue, type: APPLY " + displayKey);
    console.log("========================================");
    console.log("");
    rl.question("> ", (answer) => {
      rl.close();
      const trimmed = (answer || "").trim();
      if (trimmed !== "APPLY " + displayKey) {
        console.error("Aborted. Expected: APPLY " + displayKey);
        process.exit(2);
      }
      resolve();
    });
  });
}

async function run() {
  const { apply, specKey, windowDays, useSnapshots, top, minEnquiries, coverageWeight, weakWeight } = parseArgs();

  if (!specKey) {
    console.error("--specKey is required. Example: --specKey aqa-gcse-biology");
    process.exit(1);
  }

  const normalized = normalizeSpecKey(specKey);
  const displayKey = specKeyDisplay(normalized);

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  try {
    let applyIfMissingSnapshots = false;
    if (useSnapshots && apply) {
      const snapshot = await loadSnapshots(normalized);
      if (!snapshot) {
        await promptApplyConfirmation(displayKey);
        applyIfMissingSnapshots = true;
      }
    }

    const { markdown, meta } = await buildSprintOrderMarkdown({
      specKey: normalized,
      windowDays,
      useSnapshots,
      top,
      minEnquiries,
      weights: { coverage: coverageWeight, weak: weakWeight, demand: demandWeight },
      applyIfMissingSnapshots,
    });

    const reportsDir = path.resolve(__dirname, "..", "..", "reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
    const reportPath = path.join(reportsDir, `SPRINT_ORDER_${displayKey}_${dateStr}_${timeStr}.md`);
    fs.writeFileSync(reportPath, markdown, "utf8");
    console.log(`[buildSprintOrder] Report written to: ${reportPath}`);
    console.log(`[buildSprintOrder] Topics: ${meta.topics}, Source: ${meta.source}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
