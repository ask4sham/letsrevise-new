/**
 * Student invitation inbox + Accept/Decline (Phase 2).
 */
"use strict";

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { createAttemptLimiter } = require("../middleware/rateLimitBulk");
const {
  acceptInvitation,
  declineInvitation,
  listIncomingInvitations,
} = require("../services/studentClassConsent");

const mutationLimiter = createAttemptLimiter();

function getUserId(req) {
  return req.user?.userId ?? req.user?._id ?? req.user?.id;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.type || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

// GET /api/student-class-invitations/incoming
router.get("/incoming", auth, async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({ error: "Students only" });
    }
    const { invitations } = await listIncomingInvitations(req.user);
    return res.json({ ok: true, invitations });
  } catch (err) {
    console.error("[student-class-invitations] inbox error:", err);
    return res.status(500).json({ error: "Failed to load invitations" });
  }
});

// POST /api/student-class-invitations/:invitationPublicId/accept
router.post("/:invitationPublicId/accept", auth, mutationLimiter, async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({ error: "Students only" });
    }
    const studentId = getUserId(req);
    if (!studentId) return res.status(401).json({ error: "Unauthorized" });

    const outcome = await acceptInvitation({
      invitationPublicId: req.params.invitationPublicId,
      studentUser: req.user,
      studentId,
    });
    if (outcome.error) {
      return res.status(outcome.error.status).json(outcome.error.body);
    }
    return res.json(outcome.result);
  } catch (err) {
    console.error("[student-class-invitations] accept error:", err);
    return res.status(500).json({ error: "Failed to accept invitation" });
  }
});

// POST /api/student-class-invitations/:invitationPublicId/decline
router.post("/:invitationPublicId/decline", auth, mutationLimiter, async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({ error: "Students only" });
    }
    const studentId = getUserId(req);
    if (!studentId) return res.status(401).json({ error: "Unauthorized" });

    const outcome = await declineInvitation({
      invitationPublicId: req.params.invitationPublicId,
      studentUser: req.user,
      studentId,
    });
    if (outcome.error) {
      return res.status(outcome.error.status).json(outcome.error.body);
    }
    return res.json(outcome.result);
  } catch (err) {
    console.error("[student-class-invitations] decline error:", err);
    return res.status(500).json({ error: "Failed to decline invitation" });
  }
});

module.exports = router;
