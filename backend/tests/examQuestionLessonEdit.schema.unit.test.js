/**
 * Phase 2: lesson.examQuestions[].lessonEdit schema acceptance.
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = require("bcryptjs").hashSync("password123", 10);

describe("examQuestion lessonEdit schema", () => {
  let teacherId;
  let questionId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Schema",
      lastName: "Teacher",
      email: "eq-lesson-edit-schema@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const eq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      question: "Original MCQ?",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      marks: 2,
      topicKey: "cells",
      status: "draft",
    });
    questionId = eq._id;
  });

  test("attachment without lessonEdit remains valid", async () => {
    const lesson = await Lesson.create({
      title: "No edit",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      examQuestions: [{ questionId, addedAt: new Date() }],
    });
    expect(lesson.examQuestions).toHaveLength(1);
    expect(lesson.examQuestions[0].lessonEdit).toBeUndefined();
  });

  test("MCQ lessonEdit accepted", async () => {
    const lesson = await Lesson.create({
      title: "MCQ edit",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      examQuestions: [
        {
          questionId,
          addedAt: new Date(),
          lessonEdit: {
            type: "mcq",
            question: "Edited MCQ?",
            marks: 3,
            options: ["X", "Y", "Z", "W"],
            correctAnswer: "Y",
            correctIndex: 1,
            editedAt: new Date(),
          },
        },
      ],
    });
    expect(lesson.examQuestions[0].lessonEdit.question).toBe("Edited MCQ?");
    expect(lesson.examQuestions[0].lessonEdit.marks).toBe(3);
  });

  test("short lessonEdit accepted", async () => {
    const shortQ = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      question: "Explain cells.",
      marks: 4,
      markScheme: ["Point one"],
      topicKey: "cells",
      status: "draft",
    });
    const lesson = await Lesson.create({
      title: "Short edit",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      examQuestions: [
        {
          questionId: shortQ._id,
          addedAt: new Date(),
          lessonEdit: {
            type: "short",
            question: "Edited short?",
            marks: 5,
            markScheme: ["Edited point"],
            editedAt: new Date(),
          },
        },
      ],
    });
    expect(lesson.examQuestions[0].lessonEdit.type).toBe("short");
    expect(lesson.examQuestions[0].lessonEdit.markScheme).toEqual(["Edited point"]);
  });
});
