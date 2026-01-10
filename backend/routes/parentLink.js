const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const ParentLinkRequest = require("../models/ParentLinkRequest");
const User = require("../models/User");

// Use your existing auth middleware/guard.
// Adjust the path/name to match your project (this is the ONLY thing you might need to tweak).
const auth = require("../middleware/auth");

/**
 * Token verification (must match the signing in auth.js)
 */
function verifyParentLinkToken(token) {
  const secret = process.env.PARENT_LINK_TOKEN_SECRET;
  if (!secret) throw new Error("Missing PARENT_LINK_TOKEN_SECRET");
  return jwt.verify(token, secret);
}

/**
 * POST /api/parent-link/approve
 * Student-only (must be logged in).
 * body: { token }
 *
 * Validates token -> marks request approved -> writes studentId into parent.children[]
 */
router.post("/approve", auth, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "token required" });

    let payload;
    try {
      payload = verifyParentLinkToken(token);
    } catch (e) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    if (payload.type !== "parent_link_approval") {
      return res.status(400).json({ error: "Invalid token type" });
    }

    const studentId = req.user?.id || req.user?._id;
    if (!studentId) return res.status(401).json({ error: "Unauthorized" });

    // Ensure logged-in student matches the token’s target student
    if (studentId.toString() !== payload.studentId.toString()) {
      return res.status(403).json({ error: "Token not meant for this user" });
    }

    // Ensure user is a student
    const student = await User.findById(studentId).select("_id userType email");
    if (!student || student.userType !== "student") {
      return res.status(403).json({ error: "Student only" });
    }

    const linkReq = await ParentLinkRequest.findById(payload.reqId);
    if (!linkReq) return res.status(404).json({ error: "Request not found" });

    if (linkReq.status === "approved") {
      return res.json({ ok: true, status: "approved" });
    }
    if (linkReq.status === "rejected") {
      return res.status(400).json({ error: "Request already rejected" });
    }

    // Ensure it matches the same parent/student pair
    if (
      linkReq.parentId.toString() !== payload.parentId.toString() ||
      linkReq.studentId.toString() !== payload.studentId.toString()
    ) {
      return res.status(400).json({ error: "Token/request mismatch" });
    }

    // Approve request
    linkReq.status = "approved";
    linkReq.decidedAt = new Date();
    linkReq.decidedBy = student._id;
    await linkReq.save();

    // Write link into parent.children (ObjectId safe)
    await User.updateOne(
      { _id: linkReq.parentId },
      { $addToSet: { children: linkReq.studentId } }
    );

    return res.json({ ok: true, status: "approved" });
  } catch (err) {
    console.error("approve link error:", err);
    return res.status(500).json({ error: "Failed to approve link" });
  }
});

/**
 * POST /api/parent-link/reject
 * Student-only (must be logged in).
 * body: { token }
 */
router.post("/reject", auth, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "token required" });

    let payload;
    try {
      payload = verifyParentLinkToken(token);
    } catch (e) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    if (payload.type !== "parent_link_approval") {
      return res.status(400).json({ error: "Invalid token type" });
    }

    const studentId = req.user?.id || req.user?._id;
    if (!studentId) return res.status(401).json({ error: "Unauthorized" });

    if (studentId.toString() !== payload.studentId.toString()) {
      return res.status(403).json({ error: "Token not meant for this user" });
    }

    const student = await User.findById(studentId).select("_id userType email");
    if (!student || student.userType !== "student") {
      return res.status(403).json({ error: "Student only" });
    }

    const linkReq = await ParentLinkRequest.findById(payload.reqId);
    if (!linkReq) return res.status(404).json({ error: "Request not found" });

    if (linkReq.status === "rejected") {
      return res.json({ ok: true, status: "rejected" });
    }
    if (linkReq.status === "approved") {
      return res.status(400).json({ error: "Request already approved" });
    }

    if (
      linkReq.parentId.toString() !== payload.parentId.toString() ||
      linkReq.studentId.toString() !== payload.studentId.toString()
    ) {
      return res.status(400).json({ error: "Token/request mismatch" });
    }

    linkReq.status = "rejected";
    linkReq.decidedAt = new Date();
    linkReq.decidedBy = student._id;
    await linkReq.save();

    return res.json({ ok: true, status: "rejected" });
  } catch (err) {
    console.error("reject link error:", err);
    return res.status(500).json({ error: "Failed to reject link" });
  }
});

module.exports = router;
