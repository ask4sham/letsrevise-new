// AI Generation Jobs routes (placeholder — not wired yet)
// This router defines the public AI generation jobs namespace only; it currently
// has no handlers and will gain behavior incrementally in later phases.
// Subscription/entitlement rules are NOT enforced here yet; future phases will
// layer gating using existing entitlement utilities, but this router is ungated for now.

const express = require("express");
const { requireAiJobAccess } = require("../middleware");

// Future intended endpoints (documentation only, no handlers yet):
// - POST /            (create job)
// - GET /:id          (get single job)
// - GET /             (list jobs for current user)
// - POST /:id/cancel  (request job cancellation)

const router = express.Router();

// Global AI job access-control hook (no-op for now).
router.use(requireAiJobAccess);

module.exports = router;


