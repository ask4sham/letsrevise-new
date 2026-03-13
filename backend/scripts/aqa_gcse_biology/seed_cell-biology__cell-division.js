const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Cell Division";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Cell Division";

const MCQS = [
  { question: "Why do cells divide?", options: ["To make more energy", "For growth, repair and reproduction", "To absorb nutrients", "To make proteins only"], correctIndex: 1, marks: 1 },
  { question: "Before division, the cell must:", options: ["Shrink", "Copy its genetic material", "Lose its nucleus", "Stop respiring"], correctIndex: 1, marks: 1 },
  { question: "Mitosis produces:", options: ["Gametes", "Genetically identical body cells", "Sperm and egg only", "Four cells from one"], correctIndex: 1, marks: 1 },
  { question: "Which type of cell division is used for growth?", options: ["Meiosis only", "Mitosis", "Neither", "Both equally"], correctIndex: 1, marks: 1 },
  { question: "In the cell cycle, DNA is replicated during:", options: ["Cytokinesis", "Interphase", "Metaphase only", "Telophase only"], correctIndex: 1, marks: 1 },
  { question: "Daughter cells produced by mitosis have:", options: ["Half the chromosomes", "The same number of chromosomes as the parent", "Double the chromosomes", "No nucleus"], correctIndex: 1, marks: 1 },
  { question: "Cell division in plants and animals is important for:", options: ["Photosynthesis only", "Growth and repair of tissues", "Respiration only", "Digestion only"], correctIndex: 1, marks: 1 },
  { question: "What happens to the nucleus during mitosis?", options: ["It disappears", "It divides to form two nuclei", "It fuses with another", "It is expelled"], correctIndex: 1, marks: 1 },
  { question: "Cytokinesis is:", options: ["Replication of DNA", "Division of the cytoplasm", "Condensing of chromosomes", "Formation of spindle"], correctIndex: 1, marks: 1 },
  { question: "Uncontrolled cell division can lead to:", options: ["Healing", "Cancer", "Normal growth", "Repair"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Why do multicellular organisms need cell division?", marks: 2, markScheme: ["For growth; to replace damaged or dead cells; for asexual reproduction."] },
  { question: "What is produced when a cell divides by mitosis?", marks: 1, markScheme: ["Two genetically identical daughter cells."] },
  { question: "State what happens to the genetic material before mitosis.", marks: 1, markScheme: ["DNA is copied / replicated so each new cell gets the same genetic information."] },
  { question: "Give one way mitosis differs from meiosis.", marks: 1, markScheme: ["Mitosis produces two identical cells; meiosis produces four gametes with half the chromosomes. Either acceptable."] },
  { question: "What is the role of cell division in repair?", marks: 1, markScheme: ["To replace damaged or worn-out cells with new ones."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
