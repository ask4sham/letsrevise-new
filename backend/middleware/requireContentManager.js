// backend/middleware/requireContentManager.js
// Allows admin (full access) OR content_manager (lesson/taxonomy/content only)
function requireContentManager(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ msg: "Authentication required" });
  }
  const userType = (req.user.userType || req.user.type || "").toString().toLowerCase();
  const staffRole = (req.user.staffRole || "").toString().toLowerCase();
  const isAdmin = userType === "admin" || req.user.isAdmin;
  const isContentManager = staffRole === "content_manager";
  if (!isAdmin && !isContentManager) {
    return res.status(403).json({ msg: "Admin or content manager access required" });
  }
  next();
}

module.exports = requireContentManager;
