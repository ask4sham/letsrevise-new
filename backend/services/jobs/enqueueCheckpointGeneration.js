/**
 * Enqueue checkpoint generation after lesson publish (non-blocking).
 * Respects CHECKPOINT_GEN_ON_PUBLISH; dedupes queued/running jobs per lesson.
 */
const CheckpointGenerationJob = require("../../models/CheckpointGenerationJob");

function isCheckpointGenEnabled() {
  const v = process.env.CHECKPOINT_GEN_ON_PUBLISH;
  return v === "1" || String(v).toLowerCase() === "true";
}

/**
 * @param {{ lessonId: string|object, teacherId?: object, specKey?: string, topicKey?: string|null, userId?: object }} opts
 * @returns {Promise<import("mongoose").Document|null>}
 */
async function enqueueCheckpointGenerationAfterPublish(opts) {
  if (!isCheckpointGenEnabled()) return null;

  const lessonId = opts?.lessonId;
  if (!lessonId) return null;

  const existing = await CheckpointGenerationJob.findOne({
    lessonId,
    status: { $in: ["queued", "running"] },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (existing) {
    return existing;
  }

  const job = await CheckpointGenerationJob.create({
    lessonId,
    teacherId: opts?.teacherId || opts?.userId?._id || opts?.userId || null,
    specKey: opts?.specKey ? String(opts.specKey).trim() : "",
    topicKey: opts?.topicKey ? String(opts.topicKey).trim() : null,
    trigger: "publish",
    status: "queued",
    reviewStatus: "none",
    attempts: 0,
    logs: [{ at: new Date(), msg: "Enqueued after lesson publish" }],
    createdBy: opts?.userId?._id || opts?.userId || null,
  });

  return job;
}

module.exports = { enqueueCheckpointGenerationAfterPublish, isCheckpointGenEnabled };
