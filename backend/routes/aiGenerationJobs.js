// AI Generation Jobs — user-facing namespace.
// Auth is required on every route. Ownership is enforced at query level.

const express = require("express");
const mongoose = require("mongoose");
const { auth, requireActiveSubscription } = require("../middleware");
const AiGenerationJob = require("../models/AiGenerationJob");

const router = express.Router();

router.use(auth);

function jobNotFound(res) {
  return res.status(404).json({ error: "Job not found" });
}

function isInvalidJobId(id) {
  return !mongoose.isValidObjectId(id);
}

// Create a queued AI generation job record (no execution / provider call).
router.post("/", requireActiveSubscription, async (req, res) => {
  try {
    const job = new AiGenerationJob({
      version: 1,
      type: req.body.type,
      requestedByUserId: req.user._id,
      input: req.body && req.body.input ? req.body.input : {},
      status: "QUEUED",
    });

    await job.save();

    return res.status(201).json({
      jobId: job._id,
      status: job.status,
    });
  } catch (err) {
    console.error("Error creating AI generation job:", err);
    return res.status(500).json({
      error: "Failed to create AI generation job",
    });
  }
});

// List up to 20 recent AI generation jobs for the current user only.
router.get("/", async (req, res) => {
  try {
    const jobs = await AiGenerationJob.find({ requestedByUserId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("type status createdAt updatedAt startedAt finishedAt error");

    return res.status(200).json({ jobs });
  } catch (err) {
    console.error("Error listing AI generation jobs:", err);
    return res.status(500).json({ error: "Failed to list AI generation jobs" });
  }
});

// Return a single AI generation job owned by the current user.
router.get("/:id", async (req, res) => {
  try {
    if (isInvalidJobId(req.params.id)) return jobNotFound(res);

    const job = await AiGenerationJob.findOne({
      _id: req.params.id,
      requestedByUserId: req.user._id,
    }).select(
      "type status input output error createdAt updatedAt startedAt finishedAt"
    );

    if (!job) {
      return jobNotFound(res);
    }

    return res.status(200).json({ job });
  } catch (err) {
    if (err && err.name === "CastError") return jobNotFound(res);
    console.error("Error reading AI generation job:", err);
    return res.status(500).json({ error: "Failed to read AI generation job" });
  }
});

// Cancel an AI generation job owned by the current user (DB update only).
router.post("/:id/cancel", async (req, res) => {
  try {
    if (isInvalidJobId(req.params.id)) return jobNotFound(res);

    const job = await AiGenerationJob.findOne({
      _id: req.params.id,
      requestedByUserId: req.user._id,
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
    console.error("Error cancelling AI generation job:", err);
    return res.status(500).json({ error: "Failed to cancel AI generation job" });
  }
});

module.exports = router;
