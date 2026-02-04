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

// Minimal behavioral endpoint: explicitly mark AI generation job listing as not implemented yet.
router.get("/", (req, res) => {
  return res.status(501).json({
    error: "AI generation jobs not implemented yet",
  });
});

// Minimal behavioral endpoint: explicitly mark AI generation job retrieval by id as not implemented yet.
router.get("/:id", (req, res) => {
  return res.status(501).json({
    error: "AI generation jobs not implemented yet",
  });
});

// Minimal behavioral endpoint: explicitly mark AI generation job cancellation as not implemented yet.
router.post("/:id/cancel", (req, res) => {
  return res.status(501).json({
    error: "AI generation jobs not implemented yet",
  });
});

module.exports = router;


