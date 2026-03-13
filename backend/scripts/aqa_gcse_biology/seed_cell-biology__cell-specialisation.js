const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Cell specialisation";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Cell specialisation";

const MCQS = [
  { question: "What is meant by cell specialisation?", options: ["Cell division", "Cell develops a specific structure for a function", "Cell loses its nucleus", "Cell grows larger"], correctIndex: 1, marks: 1 },
  { question: "Which cell is specialised to carry oxygen?", options: ["Nerve cell", "Red blood cell", "Root hair cell", "Palisade cell"], correctIndex: 1, marks: 1 },
  { question: "Why do red blood cells have no nucleus?", options: ["To carry more oxygen", "To divide faster", "To fight infection", "To store glucose"], correctIndex: 0, marks: 1 },
  { question: "Which cell is adapted for absorbing water and minerals?", options: ["Sperm cell", "Root hair cell", "Palisade cell", "Red blood cell"], correctIndex: 1, marks: 1 },
  { question: "What is the function of a sperm cell?", options: ["Carry oxygen", "Fertilise egg", "Absorb light", "Transport water"], correctIndex: 1, marks: 1 },
  { question: "Palisade cells are adapted for:", options: ["Absorbing water", "Photosynthesis", "Contraction", "Transmitting impulses"], correctIndex: 1, marks: 1 },
  { question: "Which adaptation helps nerve cells transmit electrical impulses?", options: ["Large vacuole", "Long axon and myelin sheath", "Chloroplasts", "No nucleus"], correctIndex: 1, marks: 1 },
  { question: "Root hair cells have a long extension to:", options: ["Increase surface area for absorption", "Store starch", "Produce enzymes", "Carry oxygen"], correctIndex: 0, marks: 1 },
  { question: "Muscle cells contain many mitochondria. Why?", options: ["Protein synthesis", "Release energy for contraction", "Photosynthesis", "Store fat"], correctIndex: 1, marks: 1 },
  { question: "Which cell type is specialised for reproduction?", options: ["Red blood cell", "Sperm cell", "Palisade cell", "Guard cell"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State what is meant by a specialised cell.", marks: 1, markScheme: ["Cell with structure adapted for a specific function."] },
  { question: "Give two adaptations of a root hair cell.", marks: 2, markScheme: ["Long hair extension; large surface area; thin walls; many mitochondria. Any two."] },
  { question: "Explain why red blood cells have no nucleus.", marks: 2, markScheme: ["More space for haemoglobin / to carry more oxygen."] },
  { question: "Name one cell type specialised for carrying electrical impulses.", marks: 1, markScheme: ["Nerve cell / neurone."] },
  { question: "How is a palisade cell adapted for photosynthesis?", marks: 2, markScheme: ["Many chloroplasts; columnar shape / near top of leaf; large surface area."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
