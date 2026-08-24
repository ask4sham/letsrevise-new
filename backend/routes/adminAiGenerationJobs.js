// Admin AI Generation Jobs — oversight/moderation.
// Mount MUST apply auth + checkAdmin (see admin.js). No ownership filter for admins.

const express = require("express");
const mongoose = require("mongoose");
const AiGenerationJob = require("../models/AiGenerationJob");

const router = express.Router();

function jobNotFound(res) {
  return res.status(404).json({ error: "Job not found" });
}

function isInvalidJobId(id) {
  return !mongoose.isValidObjectId(id);
}

// List up to 50 AI generation jobs across users for admin oversight.
router.get("/", async (req, res) => {
  try {
    const jobs = await AiGenerationJob.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .select(
        "type status requestedByUserId createdAt updatedAt startedAt finishedAt error"
      );

    return res.status(200).json({ jobs });
  } catch (err) {
    console.error("Error listing admin AI generation jobs:", err);
    return res.status(500).json({ error: "Failed to list AI generation jobs" });
  }
});

// Return a single AI generation job by id for admin oversight.
router.get("/:id", async (req, res) => {
  try {
    if (isInvalidJobId(req.params.id)) return jobNotFound(res);

    const job = await AiGenerationJob.findOne({ _id: req.params.id }).select(
      "type status requestedByUserId input output error createdAt updatedAt startedAt finishedAt"
    );

    if (!job) {
      return jobNotFound(res);
    }

    return res.status(200).json({ job });
  } catch (err) {
    if (err && err.name === "CastError") return jobNotFound(res);
    console.error("Error reading admin AI generation job:", err);
    return res.status(500).json({ error: "Failed to read AI generation job" });
  }
});

// Cancel an AI generation job by id (admin override, DB update only).
router.post("/:id/cancel", async (req, res) => {
  try {
    if (isInvalidJobId(req.params.id)) return jobNotFound(res);

    const job = await AiGenerationJob.findOne({
      _id: req.params.id,
    });

    if (!job) {
      return jobNotFound(res);
    }

    if (!["QUEUED", "RUNNING"].includes(job.status)) {
      return res.status(400).json({ error: "Job cannot be cancelled" });
    }

    job.status = "CANCELLED";
    job.finishedAt = new Date();
    await job.save();

    return res.status(200).json({
      jobId: job._id,
      status: job.status,
    });
  } catch (err) {
    if (err && err.name === "CastError") return jobNotFound(res);
    console.error("Error cancelling admin AI generation job:", err);
    return res.status(500).json({ error: "Failed to cancel AI generation job" });
  }
});

// Retry a FAILED AI generation job by resetting it to QUEUED (DB update only).
router.post("/:id/retry", async (req, res) => {
  try {
    if (isInvalidJobId(req.params.id)) return jobNotFound(res);

    const job = await AiGenerationJob.findOne({ _id: req.params.id });

    if (!job) {
      return jobNotFound(res);
    }

    if (job.status !== "FAILED") {
      return res.status(400).json({ error: "Job cannot be retried" });
    }

    job.status = "QUEUED";
    job.startedAt = null;
    job.finishedAt = null;
    job.error = null;
    job.output = null;

    await job.save();

    return res.status(200).json({
      jobId: job._id,
      status: job.status,
    });
  } catch (err) {
    if (err && err.name === "CastError") return jobNotFound(res);
    console.error("Error retrying admin AI generation job:", err);
    return res.status(500).json({ error: "Failed to retry AI generation job" });
  }
});

module.exports = router;
