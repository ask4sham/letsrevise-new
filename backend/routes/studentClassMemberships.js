/**
 * Student accepted-class list (Phase 2). Leave deferred.
 */
"use strict";

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { listMyActiveMemberships } = require("../services/studentClassConsent");

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

module.exports = router;
