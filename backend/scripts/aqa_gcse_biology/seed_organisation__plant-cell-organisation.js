const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Plant cell organisation";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Plant cell organisation";

const MCQS = [
  { question: "Which plant organ absorbs light for photosynthesis?", options: ["Root", "Leaf", "Stem only", "Flower"], correctIndex: 1, marks: 1 },
  { question: "What is the function of root hair cells?", options: ["Photosynthesis", "Absorb water and minerals", "Produce flowers", "Support only"], correctIndex: 1, marks: 1 },
  { question: "Xylem tissue transports:", options: ["Sugars", "Water and minerals (up)", "Proteins", "Oxygen only"], correctIndex: 1, marks: 1 },
  { question: "Phloem tissue transports:", options: ["Water only", "Sugars (sucrose) and amino acids", "Minerals only", "Oxygen only"], correctIndex: 1, marks: 1 },
  { question: "Palisade mesophyll cells are adapted for:", options: ["Absorption of water", "Photosynthesis (many chloroplasts)", "Transport only", "Support only"], correctIndex: 1, marks: 1 },
  { question: "Where are stomata mainly found?", options: ["Roots", "Lower surface of leaves", "Flowers only", "Stem only"], correctIndex: 1, marks: 1 },
  { question: "The epidermis in a leaf:", options: ["Photosynthesises only", "Covers and protects; may have stomata", "Transports water only", "Stores starch only"], correctIndex: 1, marks: 1 },
  { question: "Spongy mesophyll has air spaces to:", options: ["Store water", "Allow gas exchange for photosynthesis", "Support only", "Absorb minerals"], correctIndex: 1, marks: 1 },
  { question: "Which tissue carries water from roots to leaves?", options: ["Phloem", "Xylem", "Epidermis", "Palisade"], correctIndex: 1, marks: 1 },
  { question: "Meristem tissue in plants:", options: ["Only transports", "Produces new cells; growth", "Only photosynthesises", "Only absorbs"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State the function of xylem and phloem.", marks: 2, markScheme: ["Xylem: water and minerals up. Phloem: sugars and amino acids (translocation)."] },
  { question: "How is the palisade layer adapted for photosynthesis?", marks: 2, markScheme: ["Many chloroplasts; near top of leaf; columnar; large surface area."] },
  { question: "What is the role of root hair cells?", marks: 1, markScheme: ["Absorb water and mineral ions from soil."] },
  { question: "Why do leaves have a large surface area?", marks: 1, markScheme: ["Capture more light; gas exchange."] },
  { question: "Name two plant tissues.", marks: 1, markScheme: ["Epidermis; palisade; spongy mesophyll; xylem; phloem; meristem. Any two."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
