/**
 * PR-015: Enqueue KNOWLEDGE_REFRESH job when content is published.
 * Non-blocking; fire-and-forget. Deduplicates by specKey+topicKey+type.
 */
const BackgroundJob = require("../../models/BackgroundJob");

const JOB_TYPE = "KNOWLEDGE_REFRESH";

/**
 * Enqueue a knowledge refresh job.
 * @param {{ specKey: string, topicKey?: string, sourceTypes?: string[], userId?: string|object }} opts
 * @returns {Promise<BackgroundJob|null>} The created or existing job, or null if enqueue skipped
 */
async function enqueueKnowledgeRefresh(opts) {
  const specKey = opts?.specKey ? String(opts.specKey).trim() : null;
  if (!specKey) return null;

  const topicKey = opts?.topicKey ? String(opts.topicKey).trim() : null;
  const sourceTypes = Array.isArray(opts?.sourceTypes) ? opts.sourceTypes : ["lessonBlock", "specStatement"];
  const userId = opts?.userId?._id ?? opts?.userId ?? null;

  // Avoid duplicates: reuse queued/running job for same specKey+topicKey+type
  const existing = await BackgroundJob.findOne({
    type: JOB_TYPE,
    status: { $in: ["queued", "running"] },
    specKey,
    topicKey: topicKey || null,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (existing) {
    return existing;
  }

  const job = await BackgroundJob.create({
    type: JOB_TYPE,
    status: "queued",
    specKey,
    topicKey: topicKey || null,
    sourceTypes,
    createdBy: userId,
    attempts: 0,
    logs: [{ at: new Date(), msg: "Enqueued from publish" }],
  });

  return job;
}

module.exports = { enqueueKnowledgeRefresh };
