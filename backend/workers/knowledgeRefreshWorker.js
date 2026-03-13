/**
 * PR-015: Knowledge refresh worker — polls BackgroundJob queue and runs reindex → embed → coverage.
 * Run: node backend/workers/knowledgeRefreshWorker.js
 * Or: npm run worker:knowledge-refresh
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const BackgroundJob = require("../models/BackgroundJob");
const { rebuildKnowledgeIndex } = require("../services/knowledge/rebuildKnowledgeIndex");
const { embedChangedDocuments } = require("../services/knowledge/embedChangedDocuments");
const { refreshCoverageSnapshot } = require("../services/coverage/refreshCoverageSnapshot");

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 3;

function addLog(job, msg) {
  if (!job || !job.logs) return;
  job.logs = job.logs || [];
  job.logs.push({ at: new Date(), msg });
}

async function runJob(job) {
  const { specKey, topicKey, sourceTypes } = job;
  const sourceTypesToRun =
    Array.isArray(sourceTypes) && sourceTypes.length > 0 ? sourceTypes : ["lessonBlock", "specStatement"];

  addLog(job, "Starting: index → embed → coverage");

  // A) Rebuild knowledge index
  const indexReport = await rebuildKnowledgeIndex({
    specKey,
    topicKey: topicKey || undefined,
    sourceTypes: sourceTypesToRun,
  });
  addLog(job, `Index: created=${indexReport.created} updated=${indexReport.updated} skipped=${indexReport.skipped}`);
  if (indexReport.errors?.length > 0) {
    addLog(job, `Index errors: ${indexReport.errors.slice(0, 3).join("; ")}`);
  }

  // B) Embed changed docs (safe if vector DB down)
  let embedReport = { embedded: 0, skipped: 0, failed: 0, vectorDbDown: false };
  try {
    embedReport = await embedChangedDocuments({
      specKey,
      topicKey: topicKey || undefined,
      sourceTypes: sourceTypesToRun,
    });
    if (embedReport.vectorDbDown) {
      addLog(job, "Embeddings skipped: Vector DB unavailable");
    } else {
      addLog(job, `Embed: embedded=${embedReport.embedded} skipped=${embedReport.skipped} failed=${embedReport.failed}`);
    }
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.toLowerCase().includes("econnrefused") || msg.toLowerCase().includes("connection")) {
      addLog(job, "Embeddings skipped: Vector DB connection error");
    } else {
      throw err;
    }
  }

  // C) Recompute coverage snapshot
  const covReport = await refreshCoverageSnapshot({ specKey, windowDays: 14 });
  addLog(job, `Coverage: ${covReport.rowsUpserted} rows updated`);

  addLog(job, "Completed");
}

async function pollAndRun() {
  const job = await BackgroundJob.findOne({ type: "KNOWLEDGE_REFRESH", status: "queued" })
    .sort({ createdAt: 1 })
    .exec();

  if (!job) return;

  job.status = "running";
  addLog(job, "Worker picked up job");
  await job.save();

  try {
    await runJob(job);
    job.status = "completed";
    job.error = null;
  } catch (err) {
    job.attempts = (job.attempts || 0) + 1;
    job.error = err?.message || String(err);
    addLog(job, `Attempt ${job.attempts} failed: ${job.error}`);
    if (job.attempts >= MAX_ATTEMPTS) {
      job.status = "failed";
      addLog(job, `Failed after ${MAX_ATTEMPTS} attempts`);
    } else {
      job.status = "queued";
      addLog(job, `Re-queued for retry`);
    }
  }
  await job.save();
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("[knowledgeRefreshWorker] MONGO_URI required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("[knowledgeRefreshWorker] Started, polling every", POLL_INTERVAL_MS, "ms");

  const intervalId = setInterval(pollAndRun, POLL_INTERVAL_MS);
  await pollAndRun();

  const shutdown = () => {
    clearInterval(intervalId);
    mongoose.disconnect().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[knowledgeRefreshWorker] Fatal:", err);
  process.exit(1);
});
