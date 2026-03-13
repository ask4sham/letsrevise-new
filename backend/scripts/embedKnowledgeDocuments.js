/**
 * PR-003: Embed KnowledgeDocuments and upsert to Postgres.
 * Default: dry run. Use --apply to write.
 *
 * Usage:
 *   node backend/scripts/embedKnowledgeDocuments.js
 *   node backend/scripts/embedKnowledgeDocuments.js --apply --specKey AQA_GCSE_BIOLOGY
 *   node backend/scripts/embedKnowledgeDocuments.js --apply --source specStatement
 *   node backend/scripts/embedKnowledgeDocuments.js --apply --limit 10 --batchSize 8
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const KnowledgeDocument = require("../models/KnowledgeDocument");
const { embedText, getProvider } = require("../services/embeddings/provider");
const { upsertEmbedding, getEmbeddingMeta, testConnection } = require("../services/vector/pgvectorClient");

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply;
  let specKey = null;
  let source = "all";
  let limit = null;
  let batchSize = 16;
  const specIdx = args.indexOf("--specKey");
  if (specIdx !== -1 && args[specIdx + 1]) specKey = String(args[specIdx + 1]).trim();
  const srcIdx = args.indexOf("--source");
  if (srcIdx !== -1 && args[srcIdx + 1]) {
    const s = String(args[srcIdx + 1]).trim().toLowerCase();
    if (["specstatement", "lessonblock", "all"].includes(s)) source = s === "specstatement" ? "specStatement" : s === "lessonblock" ? "lessonBlock" : "all";
  }
  const limIdx = args.indexOf("--limit");
  if (limIdx !== -1 && args[limIdx + 1]) {
    const n = parseInt(args[limIdx + 1], 10);
    if (Number.isInteger(n) && n > 0) limit = n;
  }
  const batchIdx = args.indexOf("--batchSize");
  if (batchIdx !== -1 && args[batchIdx + 1]) {
    const n = parseInt(args[batchIdx + 1], 10);
    if (Number.isInteger(n) && n >= 1) batchSize = Math.min(100, n);
  }
  return { dryRun, apply, specKey, source, limit, batchSize };
}

async function run() {
  const { dryRun, apply, specKey, source, limit, batchSize } = parseArgs();

  if (apply) {
    const url = process.env.VECTOR_DB_URL || process.env.DATABASE_URL;
    if (!url || !String(url).trim()) {
      console.error("VECTOR_DB_URL is required for --apply. Set it in .env");
      process.exit(1);
    }
    try {
      await testConnection();
    } catch (err) {
      console.error(err?.message || err);
      console.error("");
      console.error("Vector DB connection failed. If developing locally, run: npm run vector:up then npm run vector:migrate");
      process.exit(1);
    }
    const provider = getProvider();
    if (provider === "openai") {
      const key = process.env.EMBEDDINGS_API_KEY || process.env.OPENAI_API_KEY;
      if (!key || !String(key).trim()) {
        console.error("EMBEDDINGS_API_KEY or OPENAI_API_KEY required when EMBEDDINGS_PROVIDER=openai");
        process.exit(1);
      }
    }
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const query = {};
  if (specKey) query.specKey = specKey;
  if (source !== "all") query.sourceType = source;

  const docs = await KnowledgeDocument.find(query)
    .sort({ updatedAt: -1 })
    .limit(limit || 100000)
    .lean();

  const report = {
    mode: dryRun ? "DRY RUN" : "APPLY",
    provider: getProvider(),
    model: process.env.EMBEDDINGS_MODEL || (getProvider() === "openai" ? "text-embedding-3-small" : "mock"),
    filters: { specKey: specKey || "ALL", source: source || "all" },
    counts: { scanned: docs.length, embedded: 0, skippedUpToDate: 0, failed: 0 },
    failures: [],
  };

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const toEmbed = [];
    for (const doc of batch) {
      const id = String(doc._id);
      const text = (doc.text || "").trim();
      if (!text) {
        report.counts.failed++;
        if (report.failures.length < 20) report.failures.push({ knowledgeDocumentId: id, reason: "empty text" });
        continue;
      }
      try {
        if (apply) {
          const meta = await getEmbeddingMeta(id);
          if (meta && meta.contentHash === doc.contentHash) {
            report.counts.skippedUpToDate++;
            continue;
          }
        }
        toEmbed.push({ doc, id });
      } catch (e) {
        report.counts.failed++;
        if (report.failures.length < 20) report.failures.push({ knowledgeDocumentId: id, reason: e.message });
      }
    }
    if (toEmbed.length === 0) continue;
    try {
      const texts = toEmbed.map((x) => x.doc.text);
      const embeddings = await embedText(texts);
      if (embeddings.length !== toEmbed.length) {
        for (let j = 0; j < toEmbed.length; j++) {
          report.counts.failed++;
          if (report.failures.length < 20) report.failures.push({ knowledgeDocumentId: toEmbed[j].id, reason: "embedding length mismatch" });
        }
        continue;
      }
      if (apply) {
        for (let j = 0; j < toEmbed.length; j++) {
          try {
            await upsertEmbedding({
              knowledgeDocumentId: toEmbed[j].id,
              contentHash: toEmbed[j].doc.contentHash,
              embedding: embeddings[j],
            });
            report.counts.embedded++;
          } catch (e) {
            report.counts.failed++;
            if (report.failures.length < 20) report.failures.push({ knowledgeDocumentId: toEmbed[j].id, reason: e.message });
          }
        }
      } else {
        report.counts.embedded += toEmbed.length;
      }
    } catch (e) {
      for (const x of toEmbed) {
        report.counts.failed++;
        if (report.failures.length < 20) report.failures.push({ knowledgeDocumentId: x.id, reason: e.message });
      }
    }
  }

  await mongoose.disconnect();

  const now = new Date();
  const ts = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const reportDir = path.resolve(__dirname, "..", "..", "reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `EMBED_KNOWLEDGE_DOCS_${ts}.md`);

  const md = [
    `# Embed Knowledge Documents Report`,
    ``,
    `- **Mode:** ${report.mode}`,
    `- **Provider:** ${report.provider}`,
    `- **Model:** ${report.model}`,
    `- **Filters:** specKey=${report.filters.specKey}, source=${report.filters.source}`,
    ``,
    `## Counts`,
    ``,
    `| scanned | embedded | skippedUpToDate | failed |`,
    `|---------|----------|-----------------|--------|`,
    `| ${report.counts.scanned} | ${report.counts.embedded} | ${report.counts.skippedUpToDate} | ${report.counts.failed} |`,
    ``,
    `## Sample Failures (first 20)`,
    ``,
    `| knowledgeDocumentId | reason |`,
    `|---------------------|--------|`,
    ...report.failures.map((f) => `| ${f.knowledgeDocumentId} | ${f.reason} |`),
    ``,
  ].join("\n");

  fs.writeFileSync(reportPath, md, "utf8");
  console.log("Report written to:", reportPath);
  console.log(md);
}

function isConnectionError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    msg.includes("password") ||
    msg.includes("econnrefused") ||
    msg.includes("does not exist") ||
    msg.includes("extension") ||
    msg.includes("pg_hba") ||
    msg.includes("connection refused")
  );
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err?.message || err);
      if (process.argv.includes("--apply") && isConnectionError(err)) {
        console.error("");
        console.error("Vector DB connection failed. If developing locally, run: npm run vector:up then npm run vector:migrate");
      }
      process.exit(1);
    });
}

module.exports = { run };
