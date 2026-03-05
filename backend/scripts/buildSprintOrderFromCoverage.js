/**
 * PR-011: Generate SPRINT_ORDER markdown from CoverageSnapshot + weak-evidence.
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
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { computeCoverage } = require("../services/coverage/coverageEngine");
const CoverageSnapshot = require("../models/CoverageSnapshot");
const { normalizeSpecKey } = require("../config/featureFlags");

const COVERAGE_SEVERITY = { NO_SPEC: 100, EMPTY: 90, THIN: 70, OK: 30, STRONG: 10 };
const LABELS = {
  P0_NO_SPEC: "P0_NO_SPEC",
  P0_EMPTY: "P0_EMPTY",
  P1_THIN: "P1_THIN",
  P2_OK_HIGH_WEAK: "P2_OK_HIGH_WEAK",
  P3_STRONG: "P3_STRONG",
};

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

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
  const weightsIdx = args.indexOf("--weights");
  if (weightsIdx !== -1 && args[weightsIdx + 1]) {
    const s = String(args[weightsIdx + 1]);
    const m1 = s.match(/coverage=([\d.]+)/);
    const m2 = s.match(/weak=([\d.]+)/);
    if (m1) coverageWeight = parseFloat(m1[1]) || 0.65;
    if (m2) weakWeight = parseFloat(m2[1]) || 0.35;
  }

  return { apply, specKey, windowDays, useSnapshots, top, minEnquiries, coverageWeight, weakWeight };
}

/** aqa-gcse-biology -> AQA_GCSE_BIOLOGY */
function specKeyDisplay(specKey) {
  return (specKey || "").replace(/-/g, "_").toUpperCase();
}

function getSprintLabel(row, minEnquiries) {
  if (row.status === "NO_SPEC") return LABELS.P0_NO_SPEC;
  if (row.status === "EMPTY") return LABELS.P0_EMPTY;
  if (row.status === "THIN") return LABELS.P1_THIN;
  if ((row.status === "OK" || row.status === "STRONG") && row.weakRate >= 0.5 && row.enquiriesTotal >= minEnquiries) {
    return LABELS.P2_OK_HIGH_WEAK;
  }
  return LABELS.P3_STRONG;
}

function computePriority(row, minEnquiries, coverageWeight, weakWeight) {
  const coverageSeverity = COVERAGE_SEVERITY[row.status] ?? 50;
  let weakRateScaled = 0;
  if (row.enquiriesTotal >= minEnquiries && row.weakRate > 0) {
    weakRateScaled = clamp(row.weakRate * 100, 0, 100);
  }
  return Math.round(coverageSeverity * coverageWeight + weakRateScaled * weakWeight);
}

function sortSprintRows(rows, minEnquiries, coverageWeight, weakWeight) {
  const withMeta = rows.map((r) => {
    const label = getSprintLabel(r, minEnquiries);
    const priority = computePriority(r, minEnquiries, coverageWeight, weakWeight);
    return { ...r, label, priority };
  });
  const statusOrder = { NO_SPEC: 0, EMPTY: 1, THIN: 2, OK: 3, STRONG: 4 };
  withMeta.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const sa = statusOrder[a.status] ?? 5;
    const sb = statusOrder[b.status] ?? 5;
    if (sa !== sb) return sa - sb;
    if (a.score !== b.score) return a.score - b.score;
    return String(a.topicKey).localeCompare(String(b.topicKey));
  });
  return withMeta;
}

function buildMarkdown(sprintRows, specKeyDisplayVal, computedAt, source, windowDays, coverageWeight, weakWeight, minEnquiries) {
  const labelCounts = {};
  for (const r of sprintRows) {
    labelCounts[r.label] = (labelCounts[r.label] || 0) + 1;
  }

  let md = `# Sprint Order — ${specKeyDisplayVal}\n`;
  md += `ComputedAt: ${computedAt.toISOString()}\n`;
  md += `Source: ${source}\n`;
  md += `WindowDays: ${windowDays}\n`;
  md += `Weights: coverage=${coverageWeight}, weak=${weakWeight}\n`;
  md += `MinEnquiries: ${minEnquiries}\n\n`;

  md += `## Summary\n`;
  md += `- Topics: ${sprintRows.length}\n`;
  md += `- P0_NO_SPEC: ${labelCounts[LABELS.P0_NO_SPEC] || 0}\n`;
  md += `- P0_EMPTY: ${labelCounts[LABELS.P0_EMPTY] || 0}\n`;
  md += `- P1_THIN: ${labelCounts[LABELS.P1_THIN] || 0}\n`;
  md += `- P2_OK_HIGH_WEAK: ${labelCounts[LABELS.P2_OK_HIGH_WEAK] || 0}\n`;
  md += `- P3_STRONG: ${labelCounts[LABELS.P3_STRONG] || 0}\n\n`;

  md += `## Sprint Table\n`;
  md += `| rank | topicKey | priority | label | score | specStatements | specDocs | lessonDocs | enquiries | weak | weakRate |\n`;
  md += `| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
  sprintRows.forEach((r, i) => {
    md += `| ${i + 1} | ${r.topicKey} | ${r.priority} | ${r.label} | ${r.score} | ${r.specStatementsTotal} | ${r.knowledgeDocsSpec} | ${r.knowledgeDocsLesson} | ${r.enquiriesTotal} | ${r.enquiriesWeakEvidence} | ${r.weakRate.toFixed(3)} |\n`;
  });

  md += `\n## Action checklist per label\n`;
  md += `### P0_NO_SPEC\n`;
  md += `- Add SpecStatements for this topicKey (minimum: 5–10 key statements)\n`;
  md += `- Rebuild Knowledge Index + embed\n`;
  md += `- Add at least 1 lesson page with core explanation blocks\n\n`;
  md += `### P0_EMPTY\n`;
  md += `- Build lesson content blocks (aim ≥ 8 KnowledgeDocument chunks)\n`;
  md += `- Add a small set of practice questions (MCQ + short)\n`;
  md += `- Rebuild index + embed\n\n`;
  md += `### P1_THIN\n`;
  md += `- Expand lesson blocks to reach density target\n`;
  md += `- Add missing spec statements (if specIndexedRatio < 1)\n`;
  md += `- Rebuild index + embed\n\n`;
  md += `### P2_OK_HIGH_WEAK\n`;
  md += `- Read top weak questions and add:\n`;
  md += `  - clarifying blocks in the lesson\n`;
  md += `  - targeted flashcards / quiz items\n`;
  md += `- Rebuild index + embed\n\n`;
  md += `### P3_STRONG\n`;
  md += `- Maintain only; monitor weak evidence trends\n\n`;

  const weakHotspots = sprintRows.filter(
    (r) => r.enquiriesTotal >= minEnquiries && r.enquiriesWeakEvidence > 0
  );
  md += `## Weak-evidence hotspots (min enquiries >= ${minEnquiries})\n`;
  md += `| topicKey | enquiries | weak | weakRate | sampleQuestions |\n`;
  md += `| --- | ---: | ---: | ---: | --- |\n`;
  for (const r of weakHotspots) {
    const samples = (r.topWeakQuestions || [])
      .slice(0, 3)
      .map((q) => `"${(q.question || "").slice(0, 60).replace(/"/g, "'")}…"`)
      .join(" • ");
    md += `| ${r.topicKey} | ${r.enquiriesTotal} | ${r.enquiriesWeakEvidence} | ${r.weakRate.toFixed(3)} | ${samples || "-"} |\n`;
  }

  md += `\n---\n`;
  md += `\nQuestion bank audit: not generated by this script (run existing audit tooling: \`node scripts/auditQuestionBanks.js --spec <specKey>\`).\n`;

  return md;
}

async function ensureSnapshots(specKey, windowDays) {
  const normalized = normalizeSpecKey(specKey);
  const latest = await CoverageSnapshot.findOne({ specKey: normalized }).sort({ computedAt: -1 }).lean();
  if (latest) {
    const rows = await CoverageSnapshot.find({ specKey: normalized, computedAt: latest.computedAt })
      .sort({ topicKey: 1 })
      .lean();
    return { rows, source: "SNAPSHOT", computedAt: latest.computedAt };
  }
  return null;
}

async function writeSnapshotsIfNeeded(specKey, windowDays, apply, readline) {
  const snapshot = await ensureSnapshots(specKey, windowDays);
  if (snapshot) return snapshot;

  if (!apply) {
    const rows = await computeCoverage({ specKey, windowDays });
    return { rows, source: "LIVE (no snapshots saved)", computedAt: new Date() };
  }

  const displayKey = specKeyDisplay(normalizeSpecKey(specKey));
  return new Promise((resolve, reject) => {
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
      resolve(null);
    });
  }).then(async () => {
    const computedAt = new Date();
    const rows = await computeCoverage({ specKey: normalizeSpecKey(specKey), windowDays });
    if (rows.length > 0) {
      const bulkOps = rows.map((r) => ({
        updateOne: {
          filter: { specKey: normalizeSpecKey(specKey), topicKey: r.topicKey, computedAt },
          update: {
            $set: {
              specKey: normalizeSpecKey(specKey),
              topicKey: r.topicKey,
              computedAt,
              windowDays,
              specStatementsTotal: r.specStatementsTotal,
              knowledgeDocsSpec: r.knowledgeDocsSpec,
              knowledgeDocsLesson: r.knowledgeDocsLesson,
              knowledgeDocsTotal: r.knowledgeDocsTotal,
              score: r.score,
              status: r.status,
              enquiriesTotal: r.enquiriesTotal,
              enquiriesWeakEvidence: r.enquiriesWeakEvidence,
              weakRate: r.weakRate,
              topWeakQuestions: r.topWeakQuestions || [],
            },
          },
          upsert: true,
        },
      }));
      await CoverageSnapshot.bulkWrite(bulkOps);
      console.log(`[buildSprintOrder] Wrote ${rows.length} CoverageSnapshot rows`);
    }
    return { rows, source: "SNAPSHOT", computedAt };
  });
}

async function run() {
  const { apply, specKey, windowDays, useSnapshots, top, minEnquiries, coverageWeight, weakWeight } = parseArgs();
  const readline = require("readline");

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
    let rows = [];
    let source = "LIVE";
    let computedAt = new Date();

    if (useSnapshots) {
      const snapshot = await ensureSnapshots(normalized, windowDays);
      if (snapshot) {
        rows = snapshot.rows;
        source = snapshot.source;
        computedAt = snapshot.computedAt;
      } else if (apply) {
        const result = await writeSnapshotsIfNeeded(normalized, windowDays, apply, readline);
        if (result) {
          rows = result.rows;
          source = result.source;
          computedAt = result.computedAt;
        }
      } else {
        rows = await computeCoverage({ specKey: normalized, windowDays });
        source = "LIVE";
      }
    } else {
      rows = await computeCoverage({ specKey: normalized, windowDays });
    }

    const limited = top ? rows.slice(0, top) : rows;
    const sprintRows = sortSprintRows(limited, minEnquiries, coverageWeight, weakWeight);

    const md = buildMarkdown(
      sprintRows,
      displayKey,
      computedAt,
      source,
      windowDays,
      coverageWeight,
      weakWeight,
      minEnquiries
    );

    const reportsDir = path.resolve(__dirname, "..", "..", "reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
    const reportPath = path.join(reportsDir, `SPRINT_ORDER_${displayKey}_${dateStr}_${timeStr}.md`);
    fs.writeFileSync(reportPath, md, "utf8");
    console.log(`[buildSprintOrder] Report written to: ${reportPath}`);
    console.log(`[buildSprintOrder] Topics: ${sprintRows.length}, Source: ${source}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
