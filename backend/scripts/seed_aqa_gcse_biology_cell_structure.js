// PR-SEED-1: Seed AQA GCSE Biology Question Bank — Cell Biology → Cell structure
// Idempotent: only inserts if no questions exist for this topicKey. No UI changes.
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const User = require("../models/User");

const MONGO_URI = process.env.MONGO_URI;
const TAXONOMY_PATH = path.resolve(__dirname, "..", "config", "aqa_gcse_biology_topics.json");

/** Load canonical topicKey from taxonomy (Cell Biology → Cell structure). */
function getTopicKeyFromTaxonomy() {
  const raw = fs.readFileSync(TAXONOMY_PATH, "utf8");
  const taxonomy = JSON.parse(raw);
  const unit = taxonomy.units.find((u) => u.unit === "Cell Biology");
  if (!unit) throw new Error("Cell Biology unit not found in taxonomy");
  const topic = unit.topics.find((t) => t.topic === "Cell structure");
  if (!topic) throw new Error("Cell structure topic not found in taxonomy");
  return topic.key;
}

const SUBJECT = "Biology";
const EXAM_BOARD = "AQA";
const LEVEL = "GCSE";
const TOPIC_LABEL = "Cell structure";
const UNIT_LABEL = "Cell Biology";

// 10 MCQs — stem → question, options[], correctIndex (0-based), marks
const MCQS = [
  {
    question: "Which structure controls the activities of a eukaryotic cell?",
    options: ["Ribosome", "Cell membrane", "Nucleus", "Cytoplasm"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "Which structure is found in plant cells but NOT animal cells?",
    options: ["Cell membrane", "Nucleus", "Chloroplast", "Ribosome"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "What is the function of the mitochondria?",
    options: ["Protein synthesis", "Aerobic respiration", "Photosynthesis", "Cell division"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which structure controls the movement of substances into and out of the cell?",
    options: ["Cell wall", "Cytoplasm", "Cell membrane", "Nucleus"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "Ribosomes are the site of:",
    options: ["Respiration", "Protein synthesis", "Photosynthesis", "Cell division"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which structure is present in both prokaryotic and eukaryotic cells?",
    options: ["Nucleus", "Mitochondria", "Ribosome", "Chloroplast"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "What is the function of the cell wall in plant cells?",
    options: ["Controls entry and exit", "Strengthens the cell", "Site of respiration", "Contains DNA"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which structure contains genetic material in eukaryotic cells?",
    options: ["Ribosome", "Cytoplasm", "Nucleus", "Cell membrane"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "Which organelle is responsible for photosynthesis?",
    options: ["Mitochondrion", "Ribosome", "Chloroplast", "Vacuole"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "What is the role of the vacuole in plant cells?",
    options: ["Protein synthesis", "Stores cell sap and maintains turgor", "Aerobic respiration", "Controls the cell"],
    correctIndex: 1,
    marks: 1,
  },
];

// 5 short-answer — question, markScheme (accept any reasonable answer), marks
const SHORT_ANSWER = [
  {
    question: "State two structures found in animal cells.",
    marks: 2,
    markScheme: ["Nucleus", "Cytoplasm", "Cell membrane", "Ribosomes", "Mitochondria", "Any two of these"],
  },
  {
    question: "Describe the function of the nucleus.",
    marks: 2,
    markScheme: ["Controls the activities of the cell", "Contains genetic material", "Contains DNA"],
  },
  {
    question: "Explain why plant cells need chloroplasts but animal cells do not.",
    marks: 3,
    markScheme: ["Plants make their own food by photosynthesis", "Chloroplasts contain chlorophyll for photosynthesis", "Animals get food by eating other organisms"],
  },
  {
    question: "State the function of the mitochondria.",
    marks: 1,
    markScheme: ["Aerobic respiration", "Release energy", "Site of respiration"],
  },
  {
    question: "Name the structure where protein synthesis occurs.",
    marks: 1,
    markScheme: ["Ribosome", "Ribosomes"],
  },
];

async function getTeacherId() {
  if (process.env.SEED_TEACHER_ID) return process.env.SEED_TEACHER_ID;
  const teacher = await User.findOne({ userType: "teacher" }).lean();
  if (teacher) return teacher._id.toString();
  throw new Error("No teacher user found. Run seedUsers.js or set SEED_TEACHER_ID in .env");
}

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  const topicKey = getTopicKeyFromTaxonomy();
  console.log("Taxonomy topicKey for Cell Biology → Cell structure:", topicKey);

  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  const existingCount = await ExamQuestion.countDocuments({ topicKey });
  if (existingCount > 0) {
    console.log(`Already ${existingCount} question(s) for topicKey "${topicKey}". Skipping (idempotent).`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const teacherId = new mongoose.Types.ObjectId(await getTeacherId());

  const docs = [];
  for (const row of MCQS) {
    docs.push({
      teacherId,
      subject: SUBJECT,
      examBoard: EXAM_BOARD,
      level: LEVEL,
      topicKey,
      topic: TOPIC_LABEL,
      unitKey: "cell-biology",
      type: "mcq",
      marks: row.marks,
      question: row.question,
      options: row.options,
      correctIndex: row.correctIndex,
      status: "published",
    });
  }
  for (const row of SHORT_ANSWER) {
    docs.push({
      teacherId,
      subject: SUBJECT,
      examBoard: EXAM_BOARD,
      level: LEVEL,
      topicKey,
      topic: TOPIC_LABEL,
      unitKey: "cell-biology",
      type: "short",
      marks: row.marks,
      question: row.question,
      markScheme: row.markScheme || [],
      status: "published",
    });
  }

  await ExamQuestion.insertMany(docs);
  console.log("✔ Seeded 15 questions for Cell structure");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
