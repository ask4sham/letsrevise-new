/**
 * Staff-only gate for lesson-content upload routes (use after auth).
 * Permits teacher, admin, or content_manager staffRole.
 * Does not read role from body/query/headers.
 */
function requireLessonMediaUploader(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ msg: "Authentication required" });
  }
  const userType = (req.user.userType || req.user.type || "").toString().toLowerCase();
  const staffRole = (req.user.staffRole || "").toString().toLowerCase();
  const allowed =
    userType === "teacher" ||
    userType === "admin" ||
    staffRole === "content_manager";
  if (!allowed) {
    return res.status(403).json({ msg: "Teacher, admin, or content manager access required" });
  }
  return next();
}

module.exports = requireLessonMediaUploader;
