// backend/routes/pricing.js
const express = require("express");
const PRICING = require("../config/pricing");

const router = express.Router();

/**
 * Public pricing endpoint.
 * No auth required. Frontend can render Subscribe CTA consistently.
 */
router.get("/", (req, res) => {
  return res.json({
    ok: true,
    subscription: PRICING.subscription,
  });
});

module.exports = router;
