const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Required Practical: Growth";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Required Practical: Growth";

const MCQS = [
  { question: "In the growth practical we might measure the effect of:", options: ["Light only", "Antibiotics or disinfectants on bacterial growth", "Temperature only", "pH only"], correctIndex: 1, marks: 1 },
  { question: "Why do we use a control plate (no antibiotic)?", options: ["To add more bacteria", "To compare; show normal growth", "To kill bacteria", "To cool the agar"], correctIndex: 1, marks: 1 },
  { question: "Clear zones around antibiotic discs indicate:", options: ["No effect", "Bacteria have been killed or growth inhibited", "More growth", "Contamination only"], correctIndex: 1, marks: 1 },
  { question: "Larger clear zone generally means:", options: ["Bacteria resistant", "Antibiotic more effective at that concentration", "No effect", "Agar is dry"], correctIndex: 1, marks: 1 },
  { question: "Why should we spread the bacteria evenly?", options: ["To use more agar", "To get a lawn of growth so zones are clear", "To slow growth", "To heat it"], correctIndex: 1, marks: 1 },
  { question: "What is the purpose of using different concentrations of antibiotic?", options: ["To use more discs", "To compare effectiveness at different concentrations", "To sterilise", "To add nutrients"], correctIndex: 1, marks: 1 },
  { question: "After inoculation we incubate to:", options: ["Kill bacteria", "Allow bacteria to grow", "Cool the plate", "Dry the agar"], correctIndex: 1, marks: 1 },
  { question: "When measuring zones of inhibition we measure:", options: ["Only the disc", "Diameter of clear zone (or radius)", "Only the bacteria", "Colour"], correctIndex: 1, marks: 1 },
  { question: "Aseptic technique in this practical is used to:", options: ["Speed growth", "Avoid contamination and ensure only intended bacteria grow", "Add antibiotic", "Heat the plate"], correctIndex: 1, marks: 1 },
  { question: "Why might we repeat the investigation?", options: ["To use more plates", "To improve reliability and calculate mean zone size", "To change antibiotic", "To slow growth"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Describe how to investigate the effect of antibiotics on bacterial growth.", marks: 3, markScheme: ["Sterilise equipment; prepare agar plate; spread bacteria evenly; place antibiotic discs; seal and incubate; measure zones of inhibition."] },
  { question: "What does a zone of inhibition indicate?", marks: 1, markScheme: ["Area where bacteria have been killed or growth inhibited by the antibiotic."] },
  { question: "Why use a control (e.g. disc with no antibiotic)?", marks: 1, markScheme: ["To compare / show that any zones are due to the antibiotic."] },
  { question: "How could you make the investigation more reliable?", marks: 1, markScheme: ["Repeat; use same volume/concentration; measure zone diameter; same incubation time/temperature."] },
  { question: "What is a lawn of bacteria?", marks: 1, markScheme: ["Even layer of bacterial growth covering the agar surface."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
