// AI Generation Jobs routes (placeholder — not wired yet)

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


