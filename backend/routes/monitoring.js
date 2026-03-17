/**
 * Safe production monitoring verification.
 * GET /api/monitoring/test-error — intentionally throws so Sentry captures it.
 *
 * Security:
 * - Only active when NODE_ENV === "production"
 * - Requires header: x-monitoring-test: true
 * - Otherwise returns 404 (route appears to not exist)
 * - Does not log secrets
 */
const express = require("express");
const router = express.Router();

const MONITORING_TEST_HEADER = "x-monitoring-test";
const MONITORING_TEST_VALUE = "true";

router.get("/test-error", (req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";
  const hasHeader =
    String(req.get(MONITORING_TEST_HEADER) || "").toLowerCase() === MONITORING_TEST_VALUE;

  if (!isProduction || !hasHeader) {
    return res.status(404).json({ msg: "Not found" });
  }

  const err = new Error("[Monitoring] Intentional test error for Sentry verification");
  err.monitoringTest = true;
  next(err);
});

module.exports = router;
