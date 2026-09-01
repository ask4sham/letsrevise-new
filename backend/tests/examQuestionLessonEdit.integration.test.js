/**
 * Phase 2: lesson exam question lessonEdit API integration.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(30000);

describe("exam question lessonEdit integration", () => {
  let teacherToken;
  let teacherId;
  let lessonAId;
  let lessonBId;
  let mcqId;
  let shortId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "LessonEdit",
      lastName: "Teacher",
      email: "eq-lesson-edit-int@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "eq-lesson-edit-int@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("login failed");

    const mcq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      question: "Shared MCQ master?",
      options: ["Alpha", "Beta", "Gamma"],
      correctIndex: 0,
      marks: 2,
      topicKey: "photosynthesis",
      topic: "Photosynthesis",
      status: "published",
    });
    mcqId = mcq._id;

    const shortQ = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      question: "Shared short master?",
      marks: 3,
      markScheme: ["Master point"],
      correctAnswer: "Master answer",
      topicKey: "photosynthesis",
      status: "published",
    });
    shortId = shortQ._id;

    const lessonA = await Lesson.create({
      title: "Lesson A",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      topicKey: "aqa-gcse-biology:photosynthesis",
      status: "published",
      isFreePreview: true,
      examQuestions: [{ questionId: mcqId, addedAt: new Date() }],
    });
    lessonAId = lessonA._id;

    const lessonB = await Lesson.create({
      title: "Lesson B",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      topicKey: "aqa-gcse-biology:photosynthesis",
      status: "published",
      isFreePreview: true,
      examQuestions: [{ questionId: mcqId, addedAt: new Date() }],
    });
    lessonBId = lessonB._id;
  });

  test("PUT lesson-edit modifies Lesson only; master unchanged", async () => {
    const beforeMaster = await ExamQuestion.findById(mcqId).lean();

    const res = await request(app)
      .put(`/api/lessons/${lessonAId}/exam-questions/lesson-edits`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        edits: [
          {
            questionId: String(mcqId),
            lessonEdit: {
              type: "mcq",
              question: "Lesson A edited MCQ",
              marks: 4,
              options: ["One", "Two", "Three"],
              correctAnswer: "Two",
            },
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const afterMaster = await ExamQuestion.findById(mcqId).lean();
    expect(afterMaster.question).toBe(beforeMaster.question);
    expect(afterMaster.options).toEqual(beforeMaster.options);

    const lessonA = await Lesson.findById(lessonAId).lean();
    expect(lessonA.examQuestions[0].lessonEdit.question).toBe("Lesson A edited MCQ");
  });

  test("Lesson B sharing same ExamQuestion remains unchanged", async () => {
    const lessonB = await Lesson.findById(lessonBId).lean();
    expect(lessonB.examQuestions[0].lessonEdit).toBeUndefined();
  });

  test("GET /practice on Lesson A returns edited MCQ", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}/practice`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
    const q = res.body.questions.find((x) => x.id === String(mcqId));
    expect(q).toBeTruthy();
    expect(q.question).toBe("Lesson A edited MCQ");
    expect(q.correctAnswer).toBe("Two");
    expect(q.options).toEqual(["One", "Two", "Three"]);
    expect(q.marks).toBe(4);
  });

  test("GET /practice on Lesson B returns master MCQ", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonBId}/practice`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const q = res.body.questions.find((x) => x.id === String(mcqId));
    expect(q.question).toBe("Shared MCQ master?");
    expect(q.correctAnswer).toBe("Alpha");
  });

  test("Undo lessonEdit:null retains attachment", async () => {
    const res = await request(app)
      .put(`/api/lessons/${lessonAId}/exam-questions/lesson-edits`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        edits: [{ questionId: String(mcqId), lessonEdit: null }],
      });
    expect(res.status).toBe(200);

    const lessonA = await Lesson.findById(lessonAId).lean();
    expect(lessonA.examQuestions).toHaveLength(1);
    expect(lessonA.examQuestions[0].lessonEdit).toBeUndefined();

    const practice = await request(app)
      .get(`/api/lessons/${lessonAId}/practice`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const q = practice.body.questions.find((x) => x.id === String(mcqId));
    expect(q.question).toBe("Shared MCQ master?");
  });

  test("GET /exam-questions returns attachments with slot order", async () => {
    await request(app)
      .put(`/api/lessons/${lessonAId}/exam-questions/lesson-edits`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        edits: [
          {
            questionId: String(mcqId),
            lessonEdit: {
              type: "mcq",
              question: "Slot test",
              marks: 2,
              options: ["A", "B"],
              correctAnswer: "B",
            },
          },
        ],
      });

    const res = await request(app)
      .get(`/api/lessons/${lessonAId}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].slotIndex).toBe(0);
    expect(res.body.attachments[0].hasLessonEdit).toBe(true);
    expect(res.body.attachments[0].editable).toBe(true);
    expect(res.body.questions[0].question).toBe("Slot test");
  });

  test("short lessonEdit returned by GET /practice", async () => {
    const lesson = await Lesson.create({
      title: "Short lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      topicKey: "aqa-gcse-biology:photosynthesis",
      status: "published",
      isFreePreview: true,
      examQuestions: [{ questionId: shortId, addedAt: new Date() }],
    });

    await request(app)
      .put(`/api/lessons/${lesson._id}/exam-questions/lesson-edits`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        edits: [
          {
            questionId: String(shortId),
            lessonEdit: {
              type: "short",
              question: "Edited short stem",
              marks: 5,
              markScheme: ["Edited scheme line"],
            },
          },
        ],
      });

    const res = await request(app)
      .get(`/api/lessons/${lesson._id}/practice`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const q = res.body.questions.find((x) => x.id === String(shortId));
    expect(q.question).toBe("Edited short stem");
    expect(q.markScheme).toEqual(["Edited scheme line"]);
    expect(q.marks).toBe(5);
  });

  test("missing master with lessonEdit still renders from snapshot", async () => {
    const orphanId = new mongoose.Types.ObjectId();
    const lesson = await Lesson.create({
      title: "Orphan edit",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      topicKey: "aqa-gcse-biology:photosynthesis",
      status: "published",
      isFreePreview: true,
      examQuestions: [
        {
          questionId: orphanId,
          addedAt: new Date(),
          lessonEdit: {
            type: "mcq",
            question: "Snapshot orphan",
            marks: 1,
            options: ["Yes", "No"],
            correctAnswer: "Yes",
            correctIndex: 0,
            editedAt: new Date(),
          },
        },
      ],
    });

    const res = await request(app)
      .get(`/api/lessons/${lesson._id}/practice`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.body.questions.some((q) => q.question === "Snapshot orphan")).toBe(true);
  });

  test("missing master without lessonEdit is skipped", async () => {
    const missingId = new mongoose.Types.ObjectId();
    const lesson = await Lesson.create({
      title: "Missing master",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      topicKey: "aqa-gcse-biology:photosynthesis",
      status: "published",
      isFreePreview: true,
      examQuestions: [{ questionId: missingId, addedAt: new Date() }],
    });

    const res = await request(app)
      .get(`/api/lessons/${lesson._id}/practice`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.body.questions).toHaveLength(0);

    const editor = await request(app)
      .get(`/api/lessons/${lesson._id}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(editor.body.attachments[0].available).toBe(false);
    expect(editor.body.attachments[0].unsupportedReason).toMatch(/unavailable/i);
  });

  test("lesson.quiz.questions untouched by lesson-edit save", async () => {
    const lesson = await Lesson.create({
      title: "Quiz guard",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "published",
      isFreePreview: true,
      examQuestions: [{ questionId: mcqId, addedAt: new Date() }],
      quiz: {
        timeSeconds: 600,
        questions: [
          {
            id: "q1",
            type: "mcq",
            question: "Page quiz Q",
            options: ["A", "B"],
            correctAnswer: "A",
            marks: 1,
            pageId: "p1",
            sourceType: "pageQuiz",
          },
        ],
      },
    });

    await request(app)
      .put(`/api/lessons/${lesson._id}/exam-questions/lesson-edits`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        edits: [
          {
            questionId: String(mcqId),
            lessonEdit: {
              type: "mcq",
              question: "Only practice edited",
              marks: 2,
              options: ["A", "B"],
              correctAnswer: "B",
            },
          },
        ],
      });

    const reloaded = await Lesson.findById(lesson._id).lean();
    expect(reloaded.quiz.questions).toHaveLength(1);
    expect(reloaded.quiz.questions[0].question).toBe("Page quiz Q");
    expect(reloaded.quiz.questions[0].sourceType).toBe("pageQuiz");
  });
});
