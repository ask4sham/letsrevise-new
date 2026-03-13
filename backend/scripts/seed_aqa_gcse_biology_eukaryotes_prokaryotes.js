// PR-SEED-2: Seed AQA GCSE Biology — Cell Biology → Eukaryotes & Prokaryotes
// Taxonomy-driven topicKey; topic-level idempotent; status: "published".
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const User = require("../models/User");

const MONGO_URI = process.env.MONGO_URI;
const TAXONOMY_PATH = path.resolve(__dirname, "..", "config", "aqa_gcse_biology_topics.json");

/** Resolve topicKey from taxonomy (Cell Biology → Eukaryotes and prokaryotes). */
function getTopicKeyFromTaxonomy() {
  const raw = fs.readFileSync(TAXONOMY_PATH, "utf8");
  const taxonomy = JSON.parse(raw);
  const unit = taxonomy.units.find((u) => u.unit === "Cell Biology");
  if (!unit) throw new Error("Cell Biology unit not found in taxonomy");
  const topic = unit.topics.find((t) => t.topic === "Eukaryotes and prokaryotes");
  if (!topic) throw new Error("Eukaryotes and prokaryotes topic not found in taxonomy");
  return topic.key;
}

const SUBJECT = "Biology";
const EXAM_BOARD = "AQA";
const LEVEL = "GCSE";
const TOPIC_LABEL = "Eukaryotes & Prokaryotes";
const UNIT_KEY = "cell-biology";

// 10 MCQs (exact spec)
const MCQS = [
  {
    question: "Which statement best describes a prokaryotic cell?",
    options: ["It contains a nucleus.", "It contains mitochondria.", "It has genetic material but no nucleus.", "It has chloroplasts."],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "Which structure is found in eukaryotic cells but not in prokaryotic cells?",
    options: ["Cell membrane", "Cytoplasm", "Nucleus", "Ribosomes"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "Which of the following is an example of a prokaryote?",
    options: ["Yeast", "Bacterium", "Amoeba", "Plant cell"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "In prokaryotic cells, genetic material is found:",
    options: ["In the nucleus", "Free in the cytoplasm", "Inside mitochondria", "Inside chloroplasts"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which feature is common to both prokaryotic and eukaryotic cells?",
    options: ["Nucleus", "Mitochondria", "Ribosomes", "Chloroplasts"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "What is the typical size comparison between prokaryotic and eukaryotic cells?",
    options: ["Prokaryotic cells are usually larger.", "Prokaryotic cells are usually smaller.", "They are always the same size.", "Eukaryotic cells are always smaller."],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which structure produces ATP in many eukaryotic cells?",
    options: ["Ribosomes", "Mitochondria", "Nucleus", "Cell membrane"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which statement about bacterial cells is correct?",
    options: ["They contain a nucleus.", "They are eukaryotic.", "They are prokaryotic.", "They always contain chloroplasts."],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "What is a plasmid?",
    options: ["A type of mitochondrion", "A small circular piece of DNA in bacteria", "A membrane surrounding the nucleus", "A structure used for photosynthesis"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which feature is most likely found in a plant cell but not in a bacterial cell?",
    options: ["Cell membrane", "Ribosomes", "Nucleus", "Cytoplasm"],
    correctIndex: 2,
    marks: 1,
  },
];

// 5 short-answer (exact spec)
const SHORT_ANSWER = [
  {
    question: "State one difference between prokaryotic and eukaryotic cells.",
    marks: 1,
    markScheme: ["Any one: eukaryotic cells have a nucleus / prokaryotic cells do not have a nucleus; eukaryotic cells have membrane-bound organelles (e.g. mitochondria) / prokaryotic cells do not; prokaryotic cells are smaller."],
  },
  {
    question: "Explain what is meant by a prokaryotic cell.",
    marks: 2,
    markScheme: ["A cell with genetic material not enclosed in a nucleus (1). DNA is free in the cytoplasm (1) / no membrane-bound nucleus."],
  },
  {
    question: "Give two structures found in both prokaryotic and eukaryotic cells.",
    marks: 2,
    markScheme: ["Any two: cell membrane, cytoplasm, ribosomes, DNA/genetic material."],
  },
  {
    question: "What is the function of ribosomes?",
    marks: 1,
    markScheme: ["Protein synthesis / site where proteins are made."],
  },
  {
    question: "Describe what a plasmid is.",
    marks: 2,
    markScheme: ["Small circular piece of DNA (1) found in bacterial/prokaryotic cells (1) and can carry extra genes (allow: e.g. antibiotic resistance)."],
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
  console.log("Taxonomy topicKey for Cell Biology → Eukaryotes & Prokaryotes:", topicKey);

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
      unitKey: UNIT_KEY,
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
      unitKey: UNIT_KEY,
      type: "short",
      marks: row.marks,
      question: row.question,
      markScheme: row.markScheme || [],
      status: "published",
    });
  }

  await ExamQuestion.insertMany(docs);
  console.log("✔ Seeded 15 questions for Eukaryotes & Prokaryotes");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
