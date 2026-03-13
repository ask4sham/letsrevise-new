const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Interdependence";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Interdependence";

const MCQS = [
  { question: "Interdependence means:", options: ["Organisms live alone", "Organisms depend on each other (e.g. for food, shelter)", "Only plants depend", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "A stable community is one where:", options: ["Nothing changes", "All species and environmental factors are in balance", "Only one species", "Only abiotic factors change"], correctIndex: 1, marks: 1 },
  { question: "Competition occurs when:", options: ["Resources are unlimited", "Organisms need the same limited resource", "Only between species", "Only for light"], correctIndex: 1, marks: 1 },
  { question: "Predator-prey cycles show:", options: ["No relationship", "Numbers of predator and prey rise and fall in relation to each other", "Only prey increase", "Only predator increase"], correctIndex: 1, marks: 1 },
  { question: "Mutualism is when:", options: ["One benefits, one is harmed", "Both species benefit", "Only one benefits", "Neither benefits"], correctIndex: 1, marks: 1 },
  { question: "Parasitism is when:", options: ["Both benefit", "One benefits, the host is harmed", "Neither benefits", "Only the host benefits"], correctIndex: 1, marks: 1 },
  { question: "Plants compete for:", options: ["Only food", "Light; water; mineral ions; space", "Only pollinators", "Only prey"], correctIndex: 1, marks: 1 },
  { question: "Animals compete for:", options: ["Only light", "Food; water; mates; territory", "Only space in soil", "Only minerals"], correctIndex: 1, marks: 1 },
  { question: "If one species is removed from a stable community:", options: ["Nothing happens", "It can affect other species (e.g. food chains)", "Only that species is affected", "Only plants are affected"], correctIndex: 1, marks: 1 },
  { question: "Interspecific competition is between:", options: ["Same species", "Different species", "Only plants", "Only animals"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is interdependence?", marks: 1, markScheme: ["Organisms depend on each other; removal of one can affect others; stable community in balance."] },
  { question: "Give one example of mutualism.", marks: 2, markScheme: ["E.g. bees and flowers (pollination, nectar). Bacteria in gut and host. Cleaner fish and larger fish."] },
  { question: "What do plants compete for?", marks: 1, markScheme: ["Light; water; mineral ions; space."] },
  { question: "Explain why predator and prey numbers often cycle.", marks: 2, markScheme: ["More prey → more food for predators → predator numbers rise. More predators → prey eaten → prey fall. Then predator numbers fall; cycle continues."] },
  { question: "What is the difference between mutualism and parasitism?", marks: 1, markScheme: ["Mutualism: both benefit. Parasitism: one benefits, host harmed."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
