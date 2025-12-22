const express = require("express");
const router = express.Router();

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Auth route is working" });
});

// Simple register route for testing
router.post("/register", (req, res) => {
  const { email, userType } = req.body;
  res.json({ 
    message: "Registration successful (test mode)", 
    email,
    userType 
  });
});

module.exports = router;
