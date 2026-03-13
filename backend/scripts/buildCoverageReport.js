/**
 * PR-009: Build coverage report — markdown + optional CoverageSnapshot upsert.
 *
 * Usage:
 *   node backend/scripts/buildCoverageReport.js --specKey aqa-gcse-biology
 *   node backend/scripts/buildCoverageReport.js --specKey aqa-gcse-biology --apply
 *   node backend/scripts/buildCoverageReport.js --specKey aqa-gcse-biology --windowDays 14 --top 50
 *   node backend/scripts/buildCoverageReport.js --specKey aqa-gcse-biology --includeWeakQuestions false
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { computeCoverage } = require("../services/coverage/coverageEngine");
const CoverageSnapshot = require("../models/CoverageSnapshot");
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

  let top = null;
  const topIdx = args.indexOf("--top");
  if (topIdx !== -1 && args[topIdx + 1]) {
    const n = parseInt(args[topIdx + 1], 10);
    if (Number.isInteger(n) && n > 0) top = n;
  }

  let includeWeakQuestions = true;
  const weakIdx = args.indexOf("--includeWeakQuestions");
  if (weakIdx !== -1 && args[weakIdx + 1]) {
    const v = String(args[weakIdx + 1]).toLowerCase();
    includeWeakQuestions = v === "true" || v === "1" || v === "yes";
  }

  return { apply, specKey, windowDays, top, includeWeakQuestions };
}

function formatMarkdownReport(rows, specKey, computedAt, windowDays, includeWeakQuestions, top) {
  const statusCounts = { NO_SPEC: 0, EMPTY: 0, THIN: 0, OK: 0, STRONG: 0 };
  let sumScore = 0;
  for (const r of rows) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    sumScore += r.score;
  }
  const avgScore = rows.length > 0 ? Math.round((sumScore / rows.length) * 10) / 10 : 0;

  const limited = top ? rows.slice(0, top) : rows;
  const worst20 = rows.slice(0, 20);
  const weakHotspots = rows
    .filter((r) => r.enquiriesTotal >= 3 && r.enquiriesWeakEvidence > 0)
    .sort((a, b) => b.weakRate - a.weakRate)
    .slice(0, 20);

  let md = `# Coverage Report — ${specKey}\n`;
  md += `ComputedAt: ${computedAt.toISOString()}\n`;
  md += `WindowDays: ${windowDays}\n\n`;

  md += `## Summary\n`;
  md += `- Topics: ${rows.length}\n`;
  md += `- NO_SPEC: ${statusCounts.NO_SPEC}\n`;
  md += `- EMPTY: ${statusCounts.EMPTY}\n`;
  md += `- THIN: ${statusCounts.THIN}\n`;
  md += `- OK: ${statusCounts.OK}\n`;
  md += `- STRONG: ${statusCounts.STRONG}\n`;
  md += `- Avg score: ${avgScore}\n\n`;

  md += `## Topic Coverage Table\n`;
  md += `| topicKey | status | score | specStatements | specDocs | lessonDocs | enquiries | weak | weakRate |\n`;
  md += `| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
  for (const r of limited) {
    md += `| ${r.topicKey} | ${r.status} | ${r.score} | ${r.specStatementsTotal} | ${r.knowledgeDocsSpec} | ${r.knowledgeDocsLesson} | ${r.enquiriesTotal} | ${r.enquiriesWeakEvidence} | ${r.weakRate.toFixed(3)} |\n`;
  }

  md += `\n## Worst 20 topics\n`;
  md += `| topicKey | status | score | specStatements | specDocs | lessonDocs | enquiries | weak | weakRate |\n`;
  md += `| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
  for (const r of worst20) {
    md += `| ${r.topicKey} | ${r.status} | ${r.score} | ${r.specStatementsTotal} | ${r.knowledgeDocsSpec} | ${r.knowledgeDocsLesson} | ${r.enquiriesTotal} | ${r.enquiriesWeakEvidence} | ${r.weakRate.toFixed(3)} |\n`;
  }

  if (includeWeakQuestions && weakHotspots.length > 0) {
    md += `\n## Weak-evidence hotspots (top 20 by weakRate, min enquiries >= 3)\n`;
    md += `| topicKey | enquiries | weak | weakRate | sampleQuestions |\n`;
    md += `| --- | ---: | ---: | ---: | --- |\n`;
    for (const r of weakHotspots) {
      const samples = (r.topWeakQuestions || [])
        .slice(0, 3)
        .map((q) => `"${(q.question || "").slice(0, 60).replace(/"/g, "'")}…"`)
        .join(" • ");
      md += `| ${r.topicKey} | ${r.enquiriesTotal} | ${r.enquiriesWeakEvidence} | ${r.weakRate.toFixed(3)} | ${samples || "-"} |\n`;
    }
  }

  return md;
}

async function run() {
  const { apply, specKey, windowDays, top, includeWeakQuestions } = parseArgs();

  if (!specKey) {
    console.error("--specKey is required. Example: --specKey aqa-gcse-biology");
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const computedAt = new Date();
  const normalizedSpec = normalizeSpecKey(specKey);

  try {
    const rows = await computeCoverage({ specKey: normalizedSpec, windowDays });
    console.log(`[buildCoverageReport] Computed ${rows.length} topics for specKey=${normalizedSpec}`);

    const md = formatMarkdownReport(rows, normalizedSpec, computedAt, windowDays, includeWeakQuestions, top);

    const reportsDir = path.resolve(__dirname, "..", "..", "reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const ts = computedAt.toISOString().slice(0, 19).replace(/[-:T]/g, "-").replace("--", "_");
    const safeSpec = normalizedSpec.replace(/[^a-z0-9-]/gi, "_");
    const reportPath = path.join(reportsDir, `COVERAGE_${safeSpec}_${ts}.md`);
    fs.writeFileSync(reportPath, md, "utf8");
    console.log(`Report written to: ${reportPath}`);

    if (apply && rows.length > 0) {
      const bulkOps = rows.map((r) => ({
        updateOne: {
          filter: { specKey: normalizedSpec, topicKey: r.topicKey, computedAt },
          update: {
            $set: {
              specKey: normalizedSpec,
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
              summariesTotal: r.summariesTotal ?? 0,
              weakSummariesTotal: r.weakSummariesTotal ?? 0,
              summariesByMode: r.summariesByMode ?? {},
              demandScore: r.demandScore ?? 0,
            },
          },
          upsert: true,
        },
      }));
      const result = await CoverageSnapshot.bulkWrite(bulkOps);
      console.log(`[buildCoverageReport] Upserted ${result.upsertedCount + result.modifiedCount} CoverageSnapshot rows`);
    }

    const statusCounts = { NO_SPEC: 0, EMPTY: 0, THIN: 0, OK: 0, STRONG: 0 };
    for (const r of rows) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    console.log("Summary:", statusCounts);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
