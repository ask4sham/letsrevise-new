// /backend/routes/users.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");

// helper: support different auth shapes (userId vs id vs _id)
function getAuthUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id || null;
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

    const { firstName, lastName } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;

    await user.save();

    res.json({
      msg: "Profile updated successfully",
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        shamCoins: user.shamCoins,
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
