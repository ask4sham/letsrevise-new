/**
 * PR-PRACTICE-LOOP-1 Slice 3: Create student–teacher link (teacher/admin only).
 * For beta invite-only onboarding; validates student and teacher exist.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const User = require("../models/User");
const StudentTeacherLink = require("../models/StudentTeacherLink");

function getUserId(req) {
  return req.user?.userId ?? req.user?._id ?? req.user?.id;
}

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

// POST /api/admin/student-teacher-links — create link (teacher can only link students to self)
router.post("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }

  const { studentId, teacherId } = req.body || {};
  if (!studentId || !teacherId) {
    return res.status(400).json({ error: "studentId and teacherId are required" });
  }

  let studentIdObj;
  let teacherIdObj;
  try {
    studentIdObj = new mongoose.Types.ObjectId(studentId);
    teacherIdObj = new mongoose.Types.ObjectId(teacherId);
  } catch {
    return res.status(400).json({ error: "studentId and teacherId must be valid ObjectIds" });
  }

  const me = getUserId(req);
  const meUser = await User.findById(me).select("userType").lean();
  const isAdmin = meUser?.userType === "admin" || meUser?.isAdmin === true;
  if (!isAdmin && teacherIdObj.toString() !== me.toString()) {
    return res.status(403).json({ error: "Teachers can only create links for themselves as teacher. Use teacherId equal to your user id." });
  }

  const [student, teacher] = await Promise.all([
    User.findById(studentIdObj).select("userType").lean(),
    User.findById(teacherIdObj).select("userType").lean(),
  ]);
  if (!student) return res.status(400).json({ error: "Student not found" });
  if (!teacher) return res.status(400).json({ error: "Teacher not found" });
  if (student.userType !== "student") return res.status(400).json({ error: "studentId must be a student" });
  if (teacher.userType !== "teacher" && teacher.userType !== "admin") return res.status(400).json({ error: "teacherId must be a teacher or admin" });

  const existing = await StudentTeacherLink.findOne({ studentId: studentIdObj, teacherId: teacherIdObj }).lean();
  if (existing) {
    return res.status(200).json({ ok: true, linkId: existing._id, message: "Link already exists" });
  }

  const link = await StudentTeacherLink.create({ studentId: studentIdObj, teacherId: teacherIdObj });
  return res.status(201).json({ ok: true, linkId: link._id });
});

module.exports = router;
