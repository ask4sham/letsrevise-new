/**
 * Teacher lookup for Share for Review (exact email match; no directory listing).
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { lookupTeacherByEmail } = require("../services/lessonShareService");
const { sendInternalError } = require("../utils/safeErrorResponse");

function isTeacherOrAdmin(user) {
  const t = (user?.userType || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || user?.role === "admin" || user?.isAdmin === true;
}

router.get("/lookup", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ error: "Only teachers or admins can look up reviewers" });
    }
    const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
    if (!email) {
      return res.status(400).json({ error: "email query is required" });
    }
    const teacher = await lookupTeacherByEmail(email);
    if (!teacher.user) {
      return res.status(404).json({ error: "No teacher account found for that email" });
    }
    return res.json({ teacher: teacher.user });
  } catch (err) {
    return sendInternalError("teachers/lookup", err, res);
  }
});

module.exports = router;
