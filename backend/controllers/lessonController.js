const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const Template = require("../models/Template"); // ✅ ADDED: Template model

/**
 * GET /api/lessons/:id
 * Works for:
 * - Teacher (own lessons)
 * - Student (published lessons)
 * - Legacy lessons (content only)
 * - New lessons (pages[])
 */
exports.getLessonById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid lesson id" });
    }

    // IMPORTANT: lean() avoids mongoose validation crashes
    const lesson = await Lesson.findById(id)
      .populate("teacher", "firstName lastName email userType")
      .lean();

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const user = req.user || null;
    const isAdmin = user?.userType === "admin";
    const isTeacherOwner =
      user && String(lesson.teacher?._id || lesson.teacher) === String(user._id);

    // Legacy compatibility
    const status =
      lesson.status || (lesson.isPublished ? "Published" : "Draft");

    const isPublished = status === "Published";

    // Access rules
    if (!isAdmin && !isTeacherOwner && !isPublished) {
      return res.status(403).json({ message: "Lesson not published" });
    }

    // Increment views WITHOUT save()
    Lesson.updateOne({ _id: id }, { $inc: { views: 1 } }).catch(() => {});

    return res.json({
      ...lesson,
      status,
      isPublished,
      pages: Array.isArray(lesson.pages) ? lesson.pages : [],
      content: typeof lesson.content === "string" ? lesson.content : "",
    });
  } catch (error) {
    console.error("GET /api/lessons/:id ERROR", error);
    return res.status(500).json({ message: "Server error" });
  }
};
