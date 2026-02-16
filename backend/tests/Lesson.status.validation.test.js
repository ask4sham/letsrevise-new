/**
 * Phase 9D: Lesson status enum is canonical; invalid values reject saves.
 * Prevents typo status (e.g. "inreview") from creating unreviewable content.
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");

describe("Lesson status validation", () => {
  test("invalid status value (e.g. inreview) rejects save", async () => {
    const lesson = new Lesson({
      title: "Test",
      description: "Desc",
      content: "Content",
      teacherId: new mongoose.Types.ObjectId(),
      teacherName: "T",
      subject: "Bio",
      level: "GCSE",
      topic: "T",
      status: "inreview", // typo: should be "in_review"
    });
    await expect(lesson.save()).rejects.toThrow();
  });

  test("valid status in_review accepts save", async () => {
    const lesson = new Lesson({
      title: "Test",
      description: "Desc",
      content: "Content",
      teacherId: new mongoose.Types.ObjectId(),
      teacherName: "T",
      subject: "Bio",
      level: "GCSE",
      topic: "T",
      status: "in_review",
    });
    const saved = await lesson.save();
    expect(saved.status).toBe("in_review");
    await Lesson.deleteOne({ _id: saved._id });
  });

  test("LESSON_STATUSES is the canonical list", () => {
    expect(Lesson.LESSON_STATUSES).toEqual(["draft", "in_review", "published", "archived", "flagged"]);
  });
});
