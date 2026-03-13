// PR-SEED-2: Seed AQA GCSE Biology — Cell Biology → Eukaryotes and prokaryotes
// Idempotent: only inserts if no questions exist for this topicKey. status: "draft".
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const User = require("../models/User");

const MONGO_URI = process.env.MONGO_URI;
const TAXONOMY_PATH = path.resolve(__dirname, "..", "config", "aqa_gcse_biology_topics.json");

/** Load canonical topicKey from taxonomy (Cell Biology → Eukaryotes and prokaryotes). */
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
const TOPIC_LABEL = "Eukaryotes and prokaryotes";
const UNIT_KEY = "cell-biology";

// 10 MCQs
const MCQS = [
  {
    question: "Which type of cell has a membrane-bound nucleus?",
    options: ["Prokaryotic only", "Eukaryotic only", "Both prokaryotic and eukaryotic", "Neither"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Bacteria are examples of which type of cell?",
    options: ["Eukaryotic", "Prokaryotic", "Both", "Neither – they are not cells"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Where is the genetic material found in a bacterial cell?",
    options: ["Inside a membrane-bound nucleus", "In the cytoplasm", "In the cell wall", "In the ribosomes"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which is generally smaller, a typical prokaryotic cell or a eukaryotic cell?",
    options: ["Eukaryotic cell", "Prokaryotic cell", "They are the same size", "It depends on the organism"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which structure is found in prokaryotic cells but not in animal cells?",
    options: ["Ribosomes", "Cell membrane", "Cell wall", "Cytoplasm"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "Eukaryotic organisms include:",
    options: ["Bacteria only", "Animals and plants only", "Animals, plants and fungi", "Viruses only"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "In prokaryotes, the DNA is typically:",
    options: ["Linear and inside a nucleus", "Circular and in the cytoplasm", "Inside mitochondria", "Attached to the cell wall"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "What is a plasmid?",
    options: ["A type of ribosome", "A small circle of DNA in bacteria", "The cell membrane in eukaryotes", "A structure that makes proteins"],
    correctIndex: 1,
    marks: 1,
  },
  {
    question: "Which organelle is absent in prokaryotic cells?",
    options: ["Ribosome", "Cell membrane", "Mitochondrion", "Cytoplasm"],
    correctIndex: 2,
    marks: 1,
  },
  {
    question: "Yeast is an example of:",
    options: ["A prokaryote", "A eukaryote", "A bacterium", "A virus"],
    correctIndex: 1,
    marks: 1,
  },
];

// 5 short-answer
const SHORT_ANSWER = [
  {
    question: "State one difference between eukaryotic and prokaryotic cells.",
    marks: 2,
    markScheme: ["Eukaryotes have a nucleus / prokaryotes do not", "Prokaryotes are smaller", "DNA in nucleus vs in cytoplasm", "Eukaryotes have membrane-bound organelles"],
  },
  {
    question: "Describe where the genetic material is found in a bacterial cell.",
    marks: 2,
    markScheme: ["In the cytoplasm", "Not in a nucleus", "Single circular chromosome", "May have plasmids"],
  },
  {
    question: "Name the type of cell that has no membrane-bound nucleus.",
    marks: 1,
    markScheme: ["Prokaryotic", "Prokaryote"],
  },
  {
    question: "Give two examples of prokaryotic organisms.",
    marks: 2,
    markScheme: ["Bacteria", "E. coli", "Lactobacillus", "Salmonella", "Any two named bacteria"],
  },
  {
    question: "Explain why bacteria are classified as prokaryotes.",
    marks: 2,
    markScheme: ["No membrane-bound nucleus", "Genetic material in cytoplasm", "Smaller / simpler cell structure", "No membrane-bound organelles"],
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
  console.log("Taxonomy topicKey for Cell Biology → Eukaryotes and prokaryotes:", topicKey);

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
      status: "draft",
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
      status: "draft",
    });
  }

  await ExamQuestion.insertMany(docs);
  console.log("✔ Seeded 15 questions for Eukaryotes and prokaryotes");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
