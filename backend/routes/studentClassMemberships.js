/**
 * Student accepted-class list + leave (Phase 2 / 3A).
 */
"use strict";

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { createAttemptLimiter } = require("../middleware/rateLimitBulk");
const { listMyActiveMemberships } = require("../services/studentClassConsent");
const { studentLeaveMembership } = require("../services/studentClassMembershipLifecycle");

const mutationLimiter = createAttemptLimiter();

function getUserId(req) {
  return req.user?.userId ?? req.user?._id ?? req.user?.id;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.type || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

// GET /api/student-class-memberships/mine
router.get("/mine", auth, async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({ error: "Students only" });
    }
    const studentId = getUserId(req);
    if (!studentId) return res.status(401).json({ error: "Unauthorized" });

    const { classes } = await listMyActiveMemberships(studentId);
    return res.json({ ok: true, classes });
  } catch (err) {
    console.error("[student-class-memberships] mine error:", err);
    return res.status(500).json({ error: "Failed to list classes" });
  }
});

// DELETE /api/student-class-memberships/:membershipPublicId
router.delete("/:membershipPublicId", auth, mutationLimiter, async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({ error: "Students only" });
    }
    const studentId = getUserId(req);
    if (!studentId) return res.status(401).json({ error: "Unauthorized" });

    const outcome = await studentLeaveMembership({
      membershipPublicId: req.params.membershipPublicId,
      studentId,
    });
    if (outcome.error) {
      return res.status(outcome.error.status).json(outcome.error.body);
    }
    return res.json(outcome.result);
  } catch (err) {
    console.error("[student-class-memberships] leave error:", err);
    return res.status(500).json({ error: "Failed to leave class" });
  }
});

module.exports = router;
