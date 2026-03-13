// backend/middleware/requireAdmin.js — Admin-only guard (use after auth)
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ msg: "Authentication required" });
  }
  const userType = (req.user.userType || req.user.type || "").toString().toLowerCase();
  const role = (req.user.role || "").toString().toLowerCase();
  if (userType !== "admin" && role !== "admin" && !req.user.isAdmin) {
    return res.status(403).json({ msg: "Admin access required" });
  }
  next();
}

module.exports = requireAdmin;
