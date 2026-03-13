// backend/scripts/seed_cell_structure_questions.js — Seed GCSE AQA Biology Cell Structure questions (idempotent)
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const User = require("../models/User");

const MONGO_URI = process.env.MONGO_URI;
const TOPIC_KEY = "cell-structure";
const SUBJECT = "Biology";
const EXAM_BOARD = "AQA";
const LEVEL = "GCSE";

const MCQS = [
  { question: "Which structure in a plant cell contains chlorophyll?", marks: 1, options: ["Nucleus", "Chloroplast", "Mitochondrion", "Vacuole"], correctIndex: 1 },
  { question: "What is the function of the cell membrane?", marks: 1, options: ["To control what enters and leaves the cell", "To make proteins", "To store genetic information", "To release energy"], correctIndex: 0 },
  { question: "Which organelle is the site of aerobic respiration?", marks: 1, options: ["Ribosome", "Chloroplast", "Mitochondrion", "Nucleus"], correctIndex: 2 },
  { question: "Where is the genetic material found in a bacterial cell?", marks: 2, options: ["In a nucleus", "In the cytoplasm", "In the cell wall", "In the plasmid only"], correctIndex: 1 },
  { question: "Which component is found in both prokaryotic and eukaryotic cells?", marks: 1, options: ["Nucleus", "Mitochondria", "Cell membrane", "Chloroplasts"], correctIndex: 2 },
  { question: "What is the role of the ribosome?", marks: 1, options: ["To produce energy", "To make proteins", "To control the cell", "To store water"], correctIndex: 1 },
  { question: "Which cell type has a permanent vacuole?", marks: 1, options: ["Animal cell", "Plant cell", "Bacterial cell", "Fungal cell"], correctIndex: 1 },
  { question: "What is the function of the cell wall?", marks: 2, options: ["To control entry of substances", "To provide structure and support", "To make ATP", "To store DNA"], correctIndex: 1 },
  { question: "Which structure is present in a prokaryotic cell?", marks: 1, options: ["Membrane-bound nucleus", "Mitochondria", "Circular DNA", "Chloroplasts"], correctIndex: 2 },
  { question: "Where does protein synthesis occur?", marks: 1, options: ["Nucleus", "Ribosome", "Golgi apparatus", "Vacuole"], correctIndex: 1 },
];

const SHORT_ANSWER = [
  { question: "State two differences between a plant cell and an animal cell.", marks: 2, markScheme: ["Plant has cell wall / animal does not", "Plant has chloroplasts / animal does not", "Plant has large permanent vacuole"] },
  { question: "Describe the function of the nucleus.", marks: 2, markScheme: ["Contains genetic material / DNA", "Controls cell activity", "Site of DNA replication"] },
  { question: "What is the difference between a eukaryote and a prokaryote?", marks: 2, markScheme: ["Eukaryote has membrane-bound nucleus", "Prokaryote has no nucleus / DNA in cytoplasm", "Eukaryote has membrane-bound organelles"] },
  { question: "Explain why root hair cells have a large surface area.", marks: 2, markScheme: ["To absorb more water", "To absorb mineral ions", "Increases rate of absorption"] },
  { question: "Name the process by which substances move out of the cell against the concentration gradient.", marks: 1, markScheme: ["Active transport"] },
];

async function getTeacherId() {
  if (process.env.SEED_TEACHER_ID) {
    return process.env.SEED_TEACHER_ID;
  }
  const teacher = await User.findOne({ userType: "teacher" }).lean();
  if (teacher) return teacher._id.toString();
  throw new Error("No teacher user found. Run seedUsers.js or set SEED_TEACHER_ID in .env");
}

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  const teacherId = new mongoose.Types.ObjectId(await getTeacherId());
  let inserted = 0;
  let skipped = 0;

  for (const row of MCQS) {
    const existing = await ExamQuestion.findOne({
      teacherId,
      topicKey: TOPIC_KEY,
      question: row.question.trim(),
    });
    if (existing) {
      skipped++;
      continue;
    }
    await ExamQuestion.create({
      teacherId,
      subject: SUBJECT,
      examBoard: EXAM_BOARD,
      level: LEVEL,
      topicKey: TOPIC_KEY,
      topic: "Cell structure",
      type: "mcq",
      marks: row.marks,
      question: row.question,
      options: row.options,
      correctIndex: row.correctIndex,
      status: "draft",
    });
    inserted++;
  }

  for (const row of SHORT_ANSWER) {
    const existing = await ExamQuestion.findOne({
      teacherId,
      topicKey: TOPIC_KEY,
      question: row.question.trim(),
    });
    if (existing) {
      skipped++;
      continue;
    }
    await ExamQuestion.create({
      teacherId,
      subject: SUBJECT,
      examBoard: EXAM_BOARD,
      level: LEVEL,
      topicKey: TOPIC_KEY,
      topic: "Cell structure",
      type: "short",
      marks: row.marks,
      question: row.question,
      markScheme: row.markScheme || [],
      status: "draft",
    });
    inserted++;
  }

  console.log(`Cell structure questions: ${inserted} inserted, ${skipped} already existed.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
