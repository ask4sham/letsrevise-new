/**
 * Phase 4 — Curriculum-wide framework classification audit (read-only).
 *
 * Classifies every leaf topic from aqa_gcse_biology_topics.json without DB or generation changes.
 *
 * Usage:
 *   node scripts/frameworkClassificationCurriculumAudit.js
 *   node scripts/frameworkClassificationCurriculumAudit.js --json
 *   node scripts/frameworkClassificationCurriculumAudit.js --unit "Cell Biology"
 *
 * Writes: docs/audits/FRAMEWORK_CLASSIFICATION_CURRICULUM_AQA_GCSE_BIOLOGY.md
 */
const fs = require("fs");
const path = require("path");
const { classifyTopicFramework } = require("../services/topicFrameworkClassification");

const SPEC_KEY = "aqa-gcse-biology";
const TAXONOMY_PATH = path.resolve(__dirname, "../config/aqa_gcse_biology_topics.json");
const OUT_PATH = path.resolve(
  __dirname,
  "../../docs/audits/FRAMEWORK_CLASSIFICATION_CURRICULUM_AQA_GCSE_BIOLOGY.md"
);

function loadTaxonomy() {
  const raw = fs.readFileSync(TAXONOMY_PATH, "utf8");
  return JSON.parse(raw);
}

function buildRows(taxonomy, unitFilter) {
  const subject = taxonomy.subject || "Biology";
  const rows = [];
  for (const unit of taxonomy.units || []) {
    if (unitFilter && unit.unit !== unitFilter) continue;
    for (const t of unit.topics || []) {
      const topicKey = `${SPEC_KEY}:${t.key}`;
      const c = classifyTopicFramework({
        topic: t.topic,
        topicKey,
        subject,
      });
      rows.push({
        unit: unit.unit,
        topic: t.topic,
        topicKey,
        framework: c.framework,
        visualModel: c.visualModel,
        confidence: c.confidence,
        matchedBy: c.matchedBy,
        requiredPractical: Boolean(t.requiredPractical),
      });
    }
  }
  return rows;
}

function summarize(rows) {
  const byFramework = {};
  const medium = [];
  for (const r of rows) {
    byFramework[r.framework] = (byFramework[r.framework] || 0) + 1;
    if (r.confidence === "medium") medium.push(r);
  }
  return { byFramework, medium, total: rows.length };
}

function toMarkdown(rows, generatedAt) {
  const { byFramework, medium, total } = summarize(rows);
  const lines = [
    "# Framework classification — AQA GCSE Biology (curriculum audit)",
    "",
    `**Generated:** ${generatedAt}`,
    "**Source:** `backend/config/aqa_gcse_biology_topics.json`",
    "**Classifier:** `backend/services/topicFrameworkClassification.js` (read-only telemetry)",
    "",
    "> Phase 4 audit only. Does not drive Teacher Brain, briefs, or generation.",
    "",
    "## Summary",
    "",
    `- **Topics classified:** ${total}`,
    `- **High confidence:** ${total - medium.length}`,
    `- **Medium confidence (review):** ${medium.length}`,
    "",
    "### Framework distribution",
    "",
    "| Framework | Count |",
    "|-----------|------:|",
  ];
  for (const [fw, count] of Object.entries(byFramework).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${fw} | ${count} |`);
  }
  lines.push(
    "",
    "## Full curriculum",
    "",
    "| Unit | Topic | Framework | Visual model | Confidence | matchedBy |",
    "|------|-------|-----------|--------------|------------|-------------|"
  );
  for (const r of rows) {
    lines.push(
      `| ${r.unit} | ${r.topic} | ${r.framework} | ${r.visualModel} | ${r.confidence} | ${r.matchedBy} |`
    );
  }
  if (medium.length) {
    lines.push("", "## Medium confidence — review before Phase 5", "", "| Unit | Topic | Framework | matchedBy |", "|------|-------|-----------|-------------|");
    for (const r of medium) {
      lines.push(`| ${r.unit} | ${r.topic} | ${r.framework} | ${r.matchedBy} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes("--json");
  const unitIdx = args.indexOf("--unit");
  const unitFilter = unitIdx >= 0 ? args[unitIdx + 1] : null;

  const taxonomy = loadTaxonomy();
  const rows = buildRows(taxonomy, unitFilter);
  const generatedAt = new Date().toISOString();

  if (jsonOut) {
    console.log(JSON.stringify({ generatedAt, count: rows.length, rows }, null, 2));
    return;
  }

  if (!unitFilter) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, toMarkdown(rows, generatedAt), "utf8");
    console.log("Wrote", OUT_PATH);
  }

  const { medium, total } = summarize(rows);
  console.log(`Classified ${total} topics (${total - medium.length} high, ${medium.length} medium).`);
  if (unitFilter) {
    console.log("\n| Topic | Framework | Visual model | Confidence |");
    console.log("|-------|-----------|--------------|------------|");
    for (const r of rows) {
      console.log(`| ${r.topic} | ${r.framework} | ${r.visualModel} | ${r.confidence} |`);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildRows, summarize, loadTaxonomy };
