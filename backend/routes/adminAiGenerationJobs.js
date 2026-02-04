// Admin AI Generation Jobs routes (placeholder — not wired yet)

const express = require("express");
const { requireAiJobAccess } = require("../middleware");

const router = express.Router();

// Global AI job access-control hook (no-op for now) shared with public routes.
router.use(requireAiJobAccess);

module.exports = router;

