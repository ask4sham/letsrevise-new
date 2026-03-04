/**
 * PR-002: Build KnowledgeDocument index from SpecStatements and Lesson blocks.
 * Default: dry run. Use --apply to write. --specKey and --source to filter.
 *
 * Usage:
 *   node backend/scripts/buildKnowledgeIndex.js
 *   node backend/scripts/buildKnowledgeIndex.js --apply
 *   node backend/scripts/buildKnowledgeIndex.js --apply --specKey AQA_GCSE_BIOLOGY
 *   node backend/scripts/buildKnowledgeIndex.js --apply --source specStatement
 *   node backend/scripts/buildKnowledgeIndex.js --apply --source lessonBlock
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const KnowledgeDocument = require("../models/KnowledgeDocument");
const specStatementIndexer = require("../services/knowledge/indexers/specStatementIndexer");
const lessonBlockIndexer = require("../services/knowledge/indexers/lessonBlockIndexer");

const INDEXERS = {
  specStatement: specStatementIndexer,
  lessonBlock: lessonBlockIndexer,
};

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply;
  let specKey = null;
  let source = "all";
  const specIdx = args.indexOf("--specKey");
  if (specIdx !== -1 && args[specIdx + 1]) specKey = String(args[specIdx + 1]).trim();
  const srcIdx = args.indexOf("--source");
  if (srcIdx !== -1 && args[srcIdx + 1]) {
    const s = String(args[srcIdx + 1]).trim().toLowerCase();
    if (s === "specstatement" || s === "lessonblock" || s === "all") source = s;
  }
  return { dryRun, apply, specKey, source };
}

async function run() {
  const { dryRun, apply, specKey, source } = parseArgs();
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI or MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const sourcesToRun =
    source === "all" ? ["specStatement", "lessonBlock"] : [source === "specstatement" ? "specStatement" : "lessonBlock"];

  const opts = specKey ? { specKey } : {};
  const report = {
    mode: dryRun ? "DRY RUN" : "APPLY",
    filter: specKey || "ALL",
    sourcesProcessed: sourcesToRun,
    counts: { specStatement: { scanned: 0, created: 0, updated: 0, skippedUnchanged: 0 }, lessonBlock: { scanned: 0, created: 0, updated: 0, skippedUnchanged: 0 } },
    changes: [],
  };

  for (const src of sourcesToRun) {
    const indexer = INDEXERS[src];
    if (!indexer) continue;
    const candidates = await indexer.buildCandidates(opts);
    report.counts[src].scanned = candidates.length;

    for (const { doc, sourceId, chunkIndex } of candidates) {
      const existing = await KnowledgeDocument.findOne({
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        chunkIndex: doc.chunkIndex,
      }).lean();

      let action = "SKIP";
      if (!existing) {
        action = "CREATE";
        report.counts[src].created++;
        if (apply) {
          await KnowledgeDocument.create(doc);
        }
      } else if (existing.contentHash !== doc.contentHash) {
        action = "UPDATE";
        report.counts[src].updated++;
        if (apply) {
          await KnowledgeDocument.updateOne(
            { sourceType: doc.sourceType, sourceId: doc.sourceId, chunkIndex: doc.chunkIndex },
            { $set: { ...doc, updatedAt: new Date() } }
          );
        }
      } else {
        action = "SKIP";
        report.counts[src].skippedUnchanged++;
      }

      if (report.changes.length < 50) {
        const change = {
          sourceType: doc.sourceType,
          sourceId: String(doc.sourceId),
          topicKey: doc.topicKey,
          chunkIndex: doc.chunkIndex,
          action,
        };
        if (doc.sourceType === "lessonBlock" && doc.metadata) {
          if (doc.metadata.blockIndexStart != null) change.blockIndexStart = doc.metadata.blockIndexStart;
          if (doc.metadata.blockIndexEnd != null) change.blockIndexEnd = doc.metadata.blockIndexEnd;
        }
        report.changes.push(change);
      }
    }
  }

  await mongoose.disconnect();

  const now = new Date();
  const ts = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const reportDir = path.resolve(__dirname, "..", "..", "reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `KNOWLEDGE_INDEX_BUILD_${ts}.md`);

  const md = [
    `# Knowledge Index Build Report`,
    ``,
    `- **Mode:** ${report.mode}`,
    `- **Filter:** ${report.filter}`,
    `- **Sources:** ${report.sourcesProcessed.join(", ")}`,
    ``,
    `## Counts`,
    ``,
    `| sourceType | scanned | created | updated | skippedUnchanged |`,
    `|------------|---------|---------|---------|------------------|`,
    ...sourcesToRun.map(
      (s) =>
        `| ${s} | ${report.counts[s].scanned} | ${report.counts[s].created} | ${report.counts[s].updated} | ${report.counts[s].skippedUnchanged} |`
    ),
    ``,
    `## Sample Changes (first 50)`,
    ``,
    `| sourceType | sourceId | topicKey | chunkIndex | action | blockIndexStart | blockIndexEnd |`,
    `|------------|----------|----------|------------|--------|-----------------|---------------|`,
    ...report.changes.map(
      (c) =>
        `| ${c.sourceType} | ${c.sourceId.slice(-8)} | ${c.topicKey} | ${c.chunkIndex} | ${c.action} | ${c.blockIndexStart ?? "-"} | ${c.blockIndexEnd ?? "-"} |`
    ),
    ``,
  ].join("\n");

  fs.writeFileSync(reportPath, md, "utf8");
  console.log("Report written to:", reportPath);
  console.log(md);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { run };
