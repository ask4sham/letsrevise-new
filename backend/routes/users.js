// /backend/routes/users.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");

// helper: support different auth shapes (userId vs id vs _id)
function getAuthUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id || null;
}

/**
 * Derive stageKey from UK year group:
 * 7-9 => ks3
 * 10-11 => gcse
 * 12-13 => a-level
 */
function deriveStageKeyFromYearGroup(yearGroup) {
  const n = Number(yearGroup);
  if (!Number.isFinite(n)) return null;

  if (n >= 7 && n <= 9) return "ks3";
  if (n >= 10 && n <= 11) return "gcse";
  if (n >= 12 && n <= 13) return "a-level";
  return null;
}

function normalizeStageKey(v) {
  const s = (v || "").toString().trim().toLowerCase();
  if (!s) return null;

  if (s === "ks3") return "ks3";
  if (s === "gcse") return "gcse";
  if (s === "a-level" || s === "alevel" || s === "a level") return "a-level";

  return null;
}

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get("/profile", auth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ msg: "Not authenticated (no user id)" });
    }

    const user = await User.findById(userId)
      .select("-password -__v")
      .populate("purchasedLessons.lessonId", "title subject level teacherName");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // ✅ Return yearGroup + stageKey so frontend can enforce gating consistently
    res.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", auth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ msg: "Not authenticated (no user id)" });
    }

    const { firstName, lastName, schoolName, institution, yearGroup, stageKey } = req.body || {};

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // basic fields (safe for all user types)
    if (typeof firstName === "string" && firstName.trim()) user.firstName = firstName.trim();
    if (typeof lastName === "string" && lastName.trim()) user.lastName = lastName.trim();

    // keep both fields supported (your codebase uses both)
    if (typeof schoolName === "string") user.schoolName = schoolName.trim() || null;
    if (typeof institution === "string") user.institution = institution.trim() || user.institution;

    /**
     * ✅ Student-only: stage gating fields
     * - Prefer yearGroup if provided (it derives stageKey)
     * - Otherwise allow explicit stageKey (validated)
     */
    if (user.userType === "student") {
      let didUpdateStage = false;

      if (yearGroup !== undefined && yearGroup !== null && String(yearGroup).trim() !== "") {
        const yg = Number(yearGroup);
        if (!Number.isFinite(yg) || yg < 1 || yg > 14) {
          return res.status(400).json({ msg: "Invalid yearGroup (expected 1..14)" });
        }

        user.yearGroup = yg;

        const derived = deriveStageKeyFromYearGroup(yg);
        if (derived) {
          user.stageKey = derived;
        }
        didUpdateStage = true;
      }

      if (!didUpdateStage && stageKey !== undefined) {
        const normalized = normalizeStageKey(stageKey);
        if (!normalized) {
          return res.status(400).json({ msg: "Invalid stageKey (expected ks3|gcse|a-level)" });
        }
        user.stageKey = normalized;
      }
    }

    await user.save();

    res.json({
      msg: "Profile updated successfully",
      user: {
        _id: user._id,
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        shamCoins: user.shamCoins,

        // ✅ include new fields in response (non-breaking)
        yearGroup: user.yearGroup ?? null,
        stageKey: user.stageKey ?? null,

        schoolName: user.schoolName || null,
        institution: user.institution || null,

        purchasedLessons: user.purchasedLessons,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   GET /api/users/purchases
// @desc    Get user's purchased lessons
// @access  Private
router.get("/purchases", auth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ msg: "Not authenticated (no user id)" });
    }

    const user = await User.findById(userId).populate(
      "purchasedLessons.lessonId",
      "title subject level teacherName estimatedDuration shamCoinPrice"
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({
      purchasedLessons: user.purchasedLessons || [],
      totalPurchases: user.purchasedLessons?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
