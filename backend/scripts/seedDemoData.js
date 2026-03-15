/**
 * Minimal seed script for demo/staging.
 * Creates: one student, one teacher, one spec, topics, flashcards, quiz items, exam questions, sample evidence.
 * Run: node backend/scripts/seedDemoData.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const LearningEvidenceEvent = require("../models/LearningEvidenceEvent");
const { buildTopicKey } = require("../utils/topicKey");

const SPEC = "aqa-gcse-biology";
const TOPIC = "cell-structure";
const TOPIC_KEY = buildTopicKey(SPEC, TOPIC);

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGODB_URI or MONGO_URI");
    process.exit(1);
  }
  await mongoose.connect(uri);

  let teacher = await User.findOne({ userType: "teacher" }).lean();
  let student = await User.findOne({ userType: "student" }).lean();

  const hashedPassword = await bcrypt.hash("Demo123!", 10);
  if (!teacher) {
    teacher = await User.create({
      email: "demo-teacher@letsrevise.local",
      password: hashedPassword,
      firstName: "Demo",
      lastName: "Teacher",
      userType: "teacher",
    });
    console.log("Created teacher:", teacher.email);
  }
  if (!student) {
    student = await User.create({
      email: "demo-student@letsrevise.local",
      password: hashedPassword,
      firstName: "Demo",
      lastName: "Student",
      userType: "student",
    });
    console.log("Created student:", student.email);
  }

  await StudentTeacherLink.findOneAndUpdate(
    { studentId: student._id, teacherId: teacher._id },
    {},
    { upsert: true }
  );
  console.log("Linked student to teacher");

  const fcCount = await TopicFlashcard.countDocuments({ topicKey: TOPIC_KEY, ownerId: teacher._id });
  if (fcCount === 0) {
    await TopicFlashcard.create([
      { ownerId: teacher._id, topicKey: TOPIC_KEY, front: "What is the function of the nucleus?", back: "Controls cell activities and contains DNA", status: "published", fingerprint: "demo-f1" },
      { ownerId: teacher._id, topicKey: TOPIC_KEY, front: "What is the function of mitochondria?", back: "Site of aerobic respiration, produces ATP", status: "published", fingerprint: "demo-f2" },
    ]);
    console.log("Created 2 flashcards");
  }

  const qCount = await TopicQuizQuestion.countDocuments({ topicKey: TOPIC_KEY, ownerId: teacher._id });
  if (qCount === 0) {
    await TopicQuizQuestion.create({
      ownerId: teacher._id,
      topicKey: TOPIC_KEY,
      type: "mcq",
      questionText: "Which organelle is the site of protein synthesis?",
      choices: ["Nucleus", "Ribosome", "Mitochondria", "Chloroplast"],
      correctIndex: 1,
      status: "published",
    });
    console.log("Created 1 quiz question");
  }

  const eqCount = await ExamQuestion.countDocuments({ topicKey: TOPIC_KEY, teacherId: teacher._id });
  if (eqCount === 0) {
    await ExamQuestion.create({
      teacherId: teacher._id,
      subject: "Biology",
      topicKey: TOPIC_KEY,
      type: "mcq",
      question: "What is the function of the cell membrane?",
      options: ["Control entry/exit", "Store DNA", "Produce energy", "Make proteins"],
      correctIndex: 0,
      status: "published",
    });
    console.log("Created 1 exam question");
  }

  const evCount = await LearningEvidenceEvent.countDocuments({ userId: student._id, specKey: SPEC });
  if (evCount === 0) {
    await LearningEvidenceEvent.create({
      userId: student._id,
      specKey: SPEC,
      topicKey: TOPIC_KEY,
      eventType: "quiz_attempt",
      correct: true,
      score: 100,
    });
    console.log("Created sample evidence");
  }

  console.log("\nDemo seed complete. Login as demo-student@letsrevise.local / Demo123!");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
