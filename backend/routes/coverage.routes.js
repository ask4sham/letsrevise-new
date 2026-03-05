/**
 * PR-009: Coverage API — teacher + admin only.
 * GET /api/coverage — live computed
 * GET /api/coverage/snapshots — saved snapshots
 * GET /api/coverage/topics — filtered by status
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getCoverage, getSnapshots, getTopics } = require("../controllers/coverage.controller");
const coverageDrilldownRoutes = require("./coverageDrilldown.routes");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function requireTeacherOrAdmin(req, res, next) {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  next();
}

router.use(auth);

router.get("/", (req, res, next) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  return getCoverage(req, res);
});

router.get("/snapshots", (req, res, next) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  return getSnapshots(req, res);
});

router.get("/topics", (req, res, next) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  return getTopics(req, res);
});

router.use("/drilldown", requireTeacherOrAdmin, coverageDrilldownRoutes);

module.exports = router;
