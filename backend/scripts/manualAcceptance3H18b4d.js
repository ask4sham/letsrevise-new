/**
 * Phase 3H.1.8b.4d manual acceptance — VTIA telemetry (offline).
 * Usage: node backend/scripts/manualAcceptance3H18b4d.js
 */
const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const {
  buildVtiaTelemetry,
  aggregateVtiaTelemetry,
  formatVtiaTelemetryLines,
} = require("../../lib/teacherBrain/visualTaskInteractionAuthority");

const OUT_DIR = path.resolve(__dirname, "../../docs/design/validation/3H18b4d-vtia");
const FIXTURES_PATH = path.join(OUT_DIR, "fixtures.json");

function loadFixtures() {
  return JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf8"));
}

function buildMarkdownReport(report) {
  const lines = [
    "# VTIA Telemetry Report — Phase 3H.1.8b.4d",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Taxonomy: ${report.taxonomyVersion}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Lessons scanned | ${report.lessonsScanned} |`,
    `| Lessons in scope | ${report.lessonsInScope} |`,
    `| Lessons with high-confidence violation | ${report.lessonsWithHighConfidenceViolation} |`,
    `| **Violation rate** | **${report.violationRatePct}%** |`,
    "",
    "## Violation counts by intent",
    "",
  ];

  for (const [intent, count] of Object.entries(report.violationCountsByIntent)) {
    lines.push(`- **${intent}**: ${count}`);
  }

  lines.push("", "## Intent precision estimate (fixture corpus)", "");
  for (const [intent, est] of Object.entries(report.intentPrecisionEstimate)) {
    lines.push(
      `- **${intent}**: ${est.precisionLabel} (TP=${est.truePositive}, FP=${est.falsePositive}, GT+=${est.groundTruthPositive})`
    );
  }

  lines.push("", "## Lesson categories affected", "");
  for (const [cat, count] of Object.entries(report.lessonCategoriesAffected)) {
    lines.push(`- ${cat}: ${count}`);
  }

  lines.push("", "## Top offending slots", "");
  for (const slot of report.topOffendingSlots) {
    lines.push(`- \`${slot.slotKey}\`: ${slot.count}`);
  }

  lines.push("", "## Confidence distribution", "");
  for (const [level, count] of Object.entries(report.confidenceDistribution)) {
    lines.push(`- ${level}: ${count}`);
  }

  lines.push("", "## False-positive risk indicators", "");
  const fp = report.falsePositiveRiskIndicators;
  lines.push(`- High-confidence with suppressor nearby: ${fp.highConfidenceWithSuppressorNearby}`);
  lines.push(`- Medium confidence rate: ${fp.mediumConfidenceRatePct}%`);
  lines.push(`- Visual contract incomplete: ${fp.visualContractIncompleteCount}`);

  lines.push("", "## Per-lesson", "");
  for (const l of report.perLesson) {
    lines.push(`- **${l.name}** (${l.lessonCategory || "n/a"}): ${l.highConfidenceViolations} violation(s)`);
  }

  return lines.join("\n");
}

function main() {
  process.env.TEACHER_BRAIN_VTIA = "0";

  const data = loadFixtures();
  console.log("\n=== Phase 3H.1.8b.4d — VTIA Telemetry (offline) ===");
  console.log("TEACHER_BRAIN_VTIA=0 (report only)\n");

  const perLesson = [];

  for (const lesson of data.lessons) {
    const vtiaTelemetry = buildVtiaTelemetry({
      topic: lesson.topic,
      topicKey: lesson.topicKey,
      subject: lesson.subject,
      pages: lesson.pages,
    });
    console.log(`--- ${lesson.name} ---`);
    formatVtiaTelemetryLines(vtiaTelemetry).forEach((line) => console.log(line));
    console.log("");
    perLesson.push({
      name: lesson.name,
      topicKey: lesson.topicKey,
      vtiaTelemetry,
    });
  }

  const report = aggregateVtiaTelemetry(perLesson, data.fixtures);

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const jsonPath = path.join(OUT_DIR, "vtia-telemetry-report.json");
  const mdPath = path.join(OUT_DIR, "vtia-telemetry-report.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, buildMarkdownReport(report));

  console.log("=== Aggregate ===");
  console.log("Violation rate:", `${report.violationRatePct}%`);
  console.log("Intent precision estimate:");
  for (const [intent, est] of Object.entries(report.intentPrecisionEstimate)) {
    console.log(`  ${intent}: ${est.precisionLabel}`);
  }
  console.log("Top offending slots:");
  report.topOffendingSlots.forEach((s) => console.log(`  ${s.slotKey}: ${s.count}`));
  console.log("\nWrote:", jsonPath);
  console.log("Wrote:", mdPath);
}

main();
