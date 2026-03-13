/**
 * PR-004: Enquiry (RAG) API — teacher + admin + student (when flag enabled).
 * PR-006: Rate limiting. PR-007: Student access + flag check.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const enquiryRateLimit = require("../middleware/enquiryRateLimit");
const externalSearchRateLimit = require("../middleware/externalSearchRateLimit");
const { isAiTutorEnabledForSpec } = require("../config/featureFlags");
const { handleEnquiry, handleEnquiryFeedback, handleEnquiryAction } = require("../controllers/enquiry.controller");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

router.post("/", auth, enquiryRateLimit, externalSearchRateLimit, async (req, res) => {
  if (isTeacherOrAdmin(req)) {
    return handleEnquiry(req, res);
  }
  if (isStudent(req)) {
    const specKey = (req.body || {}).specKey;
    if (!isAiTutorEnabledForSpec(specKey)) {
      return res.status(403).json({
        error: "AI Tutor is not enabled for this course yet.",
      });
    }
    return handleEnquiry(req, res);
  }
  return res.status(403).json({ error: "Teachers and admins only" });
});

router.post("/:id/feedback", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  return handleEnquiryFeedback(req, res);
});

/** PR-016b: Log action click — owner or admin (same as enquiry) */
router.post("/:id/action", auth, handleEnquiryAction);

module.exports = router;
