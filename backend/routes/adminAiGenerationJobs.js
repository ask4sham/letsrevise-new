// Admin AI Generation Jobs routes (placeholder — not wired yet)

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

module.exports = router;


