const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Decomposition";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Decomposition";

const MCQS = [
  { question: "Decomposition is:", options: ["Only in water", "Breakdown of dead matter by decomposers", "Only in plants", "Only in animals"], correctIndex: 1, marks: 1 },
  { question: "Decomposers include:", options: ["Only plants", "Bacteria; fungi", "Only animals", "Only insects"], correctIndex: 1, marks: 1 },
  { question: "Decomposition is faster when:", options: ["Cold and dry", "Warm; moist; oxygen available", "Only in ice", "Only in desert"], correctIndex: 1, marks: 1 },
  { question: "Why are decomposers important?", options: ["Only for food chains", "Recycle nutrients; return minerals to soil for plants", "Only in water", "Only in compost"], correctIndex: 1, marks: 1 },
  { question: "Detritivores (e.g. worms) help decomposition by:", options: ["Only eating plants", "Breaking up dead matter; increasing surface area for decomposers", "Only eating bacteria", "Only in soil"], correctIndex: 1, marks: 1 },
  { question: "In anaerobic conditions decomposition:", options: ["Is faster", "Is slower; different decomposers (e.g. methane producers)", "Only stops", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Compost heaps decompose because:", options: ["Only heat", "Decomposers; warmth; moisture; aeration", "Only worms", "Only fungi"], correctIndex: 1, marks: 1 },
  { question: "Nutrients from dead organisms are returned to the soil as:", options: ["Only carbon", "Mineral ions (e.g. nitrates); simple molecules", "Only water", "Only oxygen"], correctIndex: 1, marks: 1 },
  { question: "Without decomposers:", options: ["More nutrients in soil", "Dead matter would build up; nutrients locked in; plants would run out", "Only more plants", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Fungi digest dead matter:", options: ["Inside their bodies only", "Outside (release enzymes); then absorb products", "Only in water", "Only in air"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is decomposition and which organisms carry it out?", marks: 2, markScheme: ["Breakdown of dead matter. Decomposers: bacteria and fungi. Detritivores (e.g. worms) help break it up."] },
  { question: "Why are decomposers important for ecosystems?", marks: 1, markScheme: ["Recycle nutrients; return mineral ions to soil; plants can absorb them again."] },
  { question: "Name two conditions that speed up decomposition.", marks: 2, markScheme: ["Warm temperature; moisture; oxygen (aerobic); suitable pH. Any two."] },
  { question: "What is the role of detritivores?", marks: 1, markScheme: ["Feed on dead matter; break it into smaller pieces; increase surface area for decomposers."] },
  { question: "Why might decomposition be slow in waterlogged soil?", marks: 1, markScheme: ["Less oxygen; anaerobic conditions; fewer aerobic decomposers."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
