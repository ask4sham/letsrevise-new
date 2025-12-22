// /backend/middleware/auth.js
console.log("🔐 Auth middleware (JWT)");

const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function auth(req, res, next) {
  try {
    // Expect: Authorization: Bearer <token>
    const authHeader = req.header("Authorization") || "";
    const token =
      authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : null;

    if (!token) {
      res.status(401).json({ msg: "No token, authorization denied" });
      return;
    }

    const secret = process.env.JWT_SECRET || "your_jwt_secret";

    const decoded = jwt.verify(token, secret);

    // Support common payload shapes:
    // - { userId: "..." }
    // - { id: "..." }
    // - { user: { id: "..." } }
    const userId =
      decoded.userId || decoded.id || decoded.user?.id || decoded.user?._id || decoded._id;

    if (!userId) {
      res.status(401).json({ msg: "Token valid but user id missing in payload" });
      return;
    }

    // Get user from database to get userType
    const user = await User.findById(userId).select('userType firstName lastName email');
    
    if (!user) {
      res.status(401).json({ msg: "User not found in database" });
      return;
    }

    req.user = {
      userId,
      userType: user.userType,
      _id: userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      ...decoded,
    };

    console.log(`✅ Auth: ${user.userType} ${user.email} authenticated`);
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ msg: "Token is not valid" });
    // Don't return here, just send the response
  }
};