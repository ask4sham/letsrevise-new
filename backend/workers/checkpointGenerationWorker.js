/**
 * Polls CheckpointGenerationJob queue and runs AI checkpoint pipeline.
 * Run: npm run worker:checkpoint-gen
 *
 * Safe retry: transient failures re-queue until MAX_ATTEMPTS; permanent errors mark failed.
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const CheckpointGenerationJob = require("../models/CheckpointGenerationJob");
const { runCheckpointGenerationJob, addLog } = require("../services/checkpointGeneration/runCheckpointGenerationJob");

const POLL_INTERVAL_MS = Number(process.env.CHECKPOINT_GEN_POLL_MS || 6000);
const MAX_ATTEMPTS = Number(process.env.CHECKPOINT_GEN_MAX_ATTEMPTS || 3);

function isTransientError(err) {
  const msg = String(err?.message || err || "");
  if (/lesson not found|no pages/i.test(msg)) return false;
  if (/API key|401|403|invalid json/i.test(msg)) return false;
  if (/rate limit|429|timeout|ECONNRESET|ETIMEDOUT|ECONNREFUSED|503|502|500/i.test(msg)) return true;
  if (!err?.response && msg.length > 0) return true;
  const status = err?.response?.status;
  if (status >= 500 || status === 429) return true;
  return false;
}

async function pollAndRun() {
  const job = await CheckpointGenerationJob.findOne({ status: "queued" }).sort({ createdAt: 1 }).exec();
  if (!job) return;

  job.status = "running";
  addLog(job, "Worker picked up job");
  await job.save();

  try {
    await runCheckpointGenerationJob(job);
    job.status = "completed";
    job.error = null;
    if (job.reviewStatus === "none") job.reviewStatus = "pending_review";
  } catch (err) {
    const msg = err?.message || String(err);
    job.error = msg.slice(0, 4000);
    addLog(job, `Error: ${msg.slice(0, 500)}`);
    job.attempts = (job.attempts || 0) + 1;

    if (!isTransientError(err) || job.attempts >= MAX_ATTEMPTS) {
      job.status = "failed";
      addLog(job, `Failed permanently (attempts=${job.attempts})`);
    } else {
      job.status = "queued";
      addLog(job, `Re-queued for retry (${job.attempts}/${MAX_ATTEMPTS})`);
    }
  }

  await job.save();
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("[checkpointGenerationWorker] MONGO_URI required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("[checkpointGenerationWorker] Started, polling every", POLL_INTERVAL_MS, "ms");

  const intervalId = setInterval(pollAndRun, POLL_INTERVAL_MS);
  await pollAndRun();

  const shutdown = () => {
    clearInterval(intervalId);
    mongoose.disconnect().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { pollAndRun };
