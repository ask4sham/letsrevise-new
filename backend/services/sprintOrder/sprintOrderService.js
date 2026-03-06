/**
 * PR-012: Sprint order service — single source of truth for PR-011 script + API.
 * Builds sprint-order markdown from CoverageSnapshot + weak-evidence.
 * Service must remain source-of-truth for both CLI and /api/sprint-order.
 */
const { computeCoverage } = require("../coverage/coverageEngine");
const CoverageSnapshot = require("../../models/CoverageSnapshot");
const { normalizeSpecKey } = require("../../config/featureFlags");

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

function computePriority(row, minEnquiries, coverageWeight, weakWeight, demandWeight = 0) {
  const coverageSeverity = COVERAGE_SEVERITY[row.status] ?? 50;
  let weakRateScaled = 0;
  if (row.enquiriesTotal >= minEnquiries && row.weakRate > 0) {
    weakRateScaled = clamp(row.weakRate * 100, 0, 100);
  }
  const demandScore = row.demandScore ?? 0;
  let score = coverageSeverity * coverageWeight + weakRateScaled * weakWeight;
  if (demandWeight > 0) {
    score += demandScore * demandWeight;
  }
  return Math.round(score);
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

function buildMarkdownContent(sprintRows, specKeyDisplayVal, computedAt, source, windowDays, coverageWeight, weakWeight, demandWeight, minEnquiries) {
  const labelCounts = {};
  for (const r of sprintRows) {
    labelCounts[r.label] = (labelCounts[r.label] || 0) + 1;
  }

  let md = `# Sprint Order — ${specKeyDisplayVal}\n`;
  md += `ComputedAt: ${computedAt.toISOString()}\n`;
  md += `Source: ${source}\n`;
  md += `WindowDays: ${windowDays}\n`;
  md += `Weights: coverage=${coverageWeight}, weak=${weakWeight}${demandWeight > 0 ? `, demand=${demandWeight}` : ""}\n`;
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

async function loadSnapshots(specKey) {
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

async function writeSnapshots(specKey, windowDays) {
  const normalized = normalizeSpecKey(specKey);
  const computedAt = new Date();
  const rows = await computeCoverage({ specKey: normalized, windowDays });
  if (rows.length > 0) {
    const bulkOps = rows.map((r) => ({
      updateOne: {
        filter: { specKey: normalized, topicKey: r.topicKey, computedAt },
        update: {
          $set: {
            specKey: normalized,
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
    await CoverageSnapshot.bulkWrite(bulkOps);
  }
  return { rows, computedAt };
}

/**
 * Build sprint order markdown.
 * @param {{
 *   specKey: string,
 *   windowDays?: number,
 *   useSnapshots?: boolean,
 *   top?: number,
 *   minEnquiries?: number,
 *   weights?: { coverage?: number, weak?: number },
 *   applyIfMissingSnapshots?: boolean,
 * }} opts
 * @returns {Promise<{ markdown: string, meta: { specKeyDisplay: string, computedAt: Date, source: string, counts: Record<string, number> }>}
 */
async function buildSprintOrderMarkdown(opts) {
  const specKey = opts.specKey;
  const windowDays = opts.windowDays ?? 14;
  const useSnapshots = opts.useSnapshots !== false;
  const top = opts.top ?? 200;
  const minEnquiries = opts.minEnquiries ?? 3;
  const coverageWeight = opts.weights?.coverage ?? 0.65;
  const weakWeight = opts.weights?.weak ?? 0.35;
  const demandWeight = opts.weights?.demand ?? 0;
  const applyIfMissingSnapshots = opts.applyIfMissingSnapshots === true;

  const normalized = normalizeSpecKey(specKey);
  const specKeyDisplayVal = specKeyDisplay(normalized);

  let rows = [];
  let source = "LIVE";
  let computedAt = new Date();

  if (useSnapshots) {
    const snapshot = await loadSnapshots(normalized);
    if (snapshot) {
      rows = snapshot.rows;
      source = snapshot.source;
      computedAt = snapshot.computedAt;
    } else if (applyIfMissingSnapshots) {
      const { rows: writtenRows, computedAt: writtenAt } = await writeSnapshots(normalized, windowDays);
      rows = writtenRows;
      source = "SNAPSHOT";
      computedAt = writtenAt;
    } else {
      rows = await computeCoverage({ specKey: normalized, windowDays });
      source = "LIVE";
    }
  } else {
    rows = await computeCoverage({ specKey: normalized, windowDays });
  }

  const limited = top ? rows.slice(0, top) : rows;
  const sprintRows = sortSprintRows(limited, minEnquiries, coverageWeight, weakWeight);

  const markdown = buildMarkdownContent(
    sprintRows,
    specKeyDisplayVal,
    computedAt,
    source,
    windowDays,
    coverageWeight,
    weakWeight,
    minEnquiries
  );

  const counts = {};
  for (const r of sprintRows) {
    counts[r.label] = (counts[r.label] || 0) + 1;
  }

  return {
    markdown,
    meta: {
      specKeyDisplay: specKeyDisplayVal,
      computedAt,
      source,
      counts,
      topics: sprintRows.length,
    },
  };
}

module.exports = {
  buildSprintOrderMarkdown,
  writeSnapshots,
  loadSnapshots,
  specKeyDisplay,
};
