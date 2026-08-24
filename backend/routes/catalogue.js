/**
 * Central catalogue availability API.
 * GET /api/catalogue/public — unauthenticated approved catalogue tree (Browse/Explore).
 * GET /api/catalogue/availability — authenticated public tree + admin-grant overlay.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const catalogueAvailabilityService = require("../services/catalogueAvailabilityService");
const { sendInternalError } = require("../utils/safeErrorResponse");

function getAuthUserId(req) {
  return req.user?._id || req.user?.userId || req.user?.id || null;
}

// GET /api/catalogue/public — approved catalogue skeleton + activations (no auth)
router.get("/public", async (req, res) => {
  try {
    const data = await catalogueAvailabilityService.getPublicCatalogueAvailability();
    return res.json(data);
  } catch (err) {
    console.error("GET /api/catalogue/public error:", err);
    return sendInternalError("catalogue/public", err, res);
  }
});

// GET /api/catalogue/availability — authenticated user's effective catalogue view
router.get("/availability", auth, async (req, res) => {
  if (req.query.userId !== undefined || req.query.user !== undefined) {
    return res.status(400).json({
      ok: false,
      error: "Query user selection is not allowed; availability is scoped to the authenticated account.",
    });
  }

  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const data = await catalogueAvailabilityService.getCatalogueAvailabilityForUser(userId);
    return res.json(data);
  } catch (err) {
    console.error("GET /api/catalogue/availability error:", err);
    return sendInternalError("catalogue/availability", err, res);
  }
});

module.exports = router;
