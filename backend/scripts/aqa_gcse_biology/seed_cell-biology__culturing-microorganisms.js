const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Culturing microorganisms";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Culturing microorganisms";

const MCQS = [
  { question: "What is a culture medium?", options: ["A type of microscope", "A substance containing nutrients for microorganism growth", "A stain", "A type of cell"], correctIndex: 1, marks: 1 },
  { question: "Why are petri dishes and culture media sterilised before use?", options: ["To make them grow faster", "To kill unwanted microorganisms", "To add nutrients", "To cool them"], correctIndex: 1, marks: 1 },
  { question: "What is aseptic technique?", options: ["Using a microscope", "Procedure to avoid contamination", "A type of stain", "Heating only"], correctIndex: 1, marks: 1 },
  { question: "Why is the lid of a petri dish secured with tape and stored upside down?", options: ["To let light in", "To prevent condensation dripping onto the culture", "To heat it", "To dry it"], correctIndex: 1, marks: 1 },
  { question: "At what temperature are school cultures usually incubated?", options: ["37 °C", "25 °C to reduce harmful pathogen growth", "100 °C", "0 °C"], correctIndex: 1, marks: 1 },
  { question: "What can be used to sterilise inoculating loops?", options: ["Cold water", "Flame / Bunsen burner", "Soap only", "Nothing"], correctIndex: 1, marks: 1 },
  { question: "Agar is used in culture media because:", options: ["It is a nutrient", "It sets solid and provides a surface for growth", "It kills bacteria", "It is liquid"], correctIndex: 1, marks: 1 },
  { question: "Why should you not open a petri dish after incubation?", options: ["To keep it warm", "To avoid releasing potentially harmful microorganisms", "To speed growth", "To add more agar"], correctIndex: 1, marks: 1 },
  { question: "What is inoculation?", options: ["Killing bacteria", "Introducing microorganisms to a culture medium", "Sterilising", "Counting colonies"], correctIndex: 1, marks: 1 },
  { question: "Colony count can be used to:", options: ["Sterilise", "Estimate number of bacteria", "Heat the agar", "Add nutrients"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Why is aseptic technique important when culturing microorganisms?", marks: 2, markScheme: ["Prevent contamination; avoid introducing unwanted microbes; avoid releasing pathogens; reliable results."] },
  { question: "Describe one way to sterilise equipment before culturing.", marks: 1, markScheme: ["Flame inoculating loop; use autoclave; sterilise agar and petri dishes."] },
  { question: "Why are school cultures often incubated at 25 °C rather than 37 °C?", marks: 1, markScheme: ["Reduce growth of harmful human pathogens / safer."] },
  { question: "What is a culture medium?", marks: 1, markScheme: ["Substance containing nutrients for microorganisms to grow (e.g. agar with nutrients)."] },
  { question: "Why should petri dishes be stored upside down after inoculation?", marks: 1, markScheme: ["Prevent condensation dripping onto the culture / contaminating or spreading growth."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
