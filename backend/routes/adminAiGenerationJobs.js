// Admin AI Generation Jobs routes (placeholder — not wired yet)
// This admin router mirrors the public AI generation jobs namespace and is
// intended for oversight/moderation access; all handlers are placeholders for now.
// Admin endpoints are expected to bypass subscription/entitlement checks by design,
// consistent with other admin routes; no such enforcement exists here yet.

const express = require("express");
const { requireAiJobAccess } = require("../middleware");

// Future intended admin endpoints (documentation only, no handlers yet):
// - GET /             (list all jobs across users/types)
// - GET /:id          (inspect a specific job)
// - POST /:id/cancel  (force cancel a job)
// - POST /:id/retry   (admin-triggered retry)

const router = express.Router();

// Global AI job access-control hook (no-op for now) shared with public routes.
router.use(requireAiJobAccess);

// Minimal admin endpoint: explicitly mark AI generation job admin listing as not implemented yet.
router.get("/", (req, res) => {
  return res.status(501).json({
    error: "AI generation jobs not implemented yet",
  });
});

// Minimal admin endpoint: explicitly mark AI generation job admin retrieval by id as not implemented yet.
router.get("/:id", (req, res) => {
  return res.status(501).json({
    error: "AI generation jobs not implemented yet",
  });
});

// Minimal admin endpoint: explicitly mark AI generation job admin cancellation as not implemented yet.
router.post("/:id/cancel", (req, res) => {
  return res.status(501).json({
    error: "AI generation jobs not implemented yet",
  });
});

module.exports = router;


