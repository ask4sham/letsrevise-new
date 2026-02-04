// AI Generation Jobs routes (placeholder — not wired yet)
// This router defines the public AI generation jobs namespace only; it currently
// has no handlers and will gain behavior incrementally in later phases.
// Subscription/entitlement rules are NOT enforced here yet; future phases will
// layer gating using existing entitlement utilities, but this router is ungated for now.

const express = require("express");
const { requireAiJobAccess } = require("../middleware");
const AiGenerationJob = require("../models/AiGenerationJob");

// Future intended endpoints (documentation only, no handlers yet):
// - POST /            (create job)
// - GET /:id          (get single job)
// - GET /             (list jobs for current user)
// - POST /:id/cancel  (request job cancellation)

const router = express.Router();

// Global AI job access-control hook (no-op for now).
router.use(requireAiJobAccess);

// Minimal behavioral endpoint: create a queued AI generation job record (no execution yet).
router.post("/", async (req, res) => {
  try {
    const job = new AiGenerationJob({
      version: 1,
      type: req.body.type,
      requestedByUserId: req.user && req.user._id,
      input: req.body && req.body.input ? req.body.input : {},
      status: "QUEUED",
    });

    await job.save();

    return res.status(201).json({
      jobId: job._id,
      status: job.status,
    });
  } catch (err) {
    // Minimal error handling; no additional logic
    console.error("Error creating AI generation job:", err);
    return res.status(500).json({
      error: "Failed to create AI generation job",
    });
  }
});

// Minimal behavioral endpoint: list up to 20 recent AI generation jobs for the current user.
router.get("/", async (req, res) => {
  const jobs = await AiGenerationJob.find({ requestedByUserId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .select("type status createdAt updatedAt startedAt finishedAt error");

  return res.status(200).json({ jobs });
});

// Minimal behavioral endpoint: return a single AI generation job owned by the current user.
router.get("/:id", async (req, res) => {
  const job = await AiGenerationJob.findOne({
    _id: req.params.id,
    requestedByUserId: req.user._id,
  }).select(
    "type status input output error createdAt updatedAt startedAt finishedAt"
  );

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  return res.status(200).json({ job });
});

// Minimal behavioral endpoint: cancel an AI generation job owned by the current user (DB update only).
router.post("/:id/cancel", async (req, res) => {
  const job = await AiGenerationJob.findOne({
    _id: req.params.id,
    requestedByUserId: req.user._id,
  });

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
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
});

module.exports = router;


