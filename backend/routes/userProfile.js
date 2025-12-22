const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");

// GET api/user/me  – get current user (sans password)
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error("Get current user error:", err);
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

// PUT api/user/me – update own basic profile
router.put("/me", auth, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("Update own profile error:", err);
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

// PUT api/user/:id – admin can update any user (basic fields)
router.put("/:id", auth, async (req, res) => {
  try {
    if (req.user.userType !== "admin") {
      return res
        .status(403)
        .json({ success: false, msg: "Admin access required" });
    }

    const allowedFields = ["firstName", "lastName", "email", "userType", "shamCoins"];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("Admin update user error:", err);
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

module.exports = router;
