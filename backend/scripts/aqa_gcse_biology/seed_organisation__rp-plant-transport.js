const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Required Practical: Plant transport";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Required Practical: Plant transport";

const MCQS = [
  { question: "We can investigate transpiration using:", options: ["A potometer", "A thermometer only", "A pH meter only", "A balance only"], correctIndex: 0, marks: 1 },
  { question: "A potometer measures:", options: ["Rate of photosynthesis", "Water uptake (as estimate of transpiration)", "Mineral uptake", "Sugar movement"], correctIndex: 1, marks: 1 },
  { question: "Why is the cut stem placed under water when setting up a potometer?", options: ["To cool it", "To prevent air entering the xylem", "To add minerals", "To close stomata"], correctIndex: 1, marks: 1 },
  { question: "What could we change to investigate transpiration rate?", options: ["Only temperature", "Light, temperature, humidity, wind", "Only water", "Only plant type"], correctIndex: 1, marks: 1 },
  { question: "Water uptake in a potometer is used as an estimate of transpiration because:", options: ["They are unrelated", "Most water taken up is lost by transpiration", "Roots store all water", "Phloem carries it all"], correctIndex: 1, marks: 1 },
  { question: "To make the investigation reliable we should:", options: ["Use one plant only", "Repeat; control variables; use same species", "Change all variables", "Use different plants each time"], correctIndex: 1, marks: 1 },
  { question: "Which condition would likely increase the rate in the potometer?", options: ["Low light", "Wind or increased temperature", "High humidity", "Closed stomata"], correctIndex: 1, marks: 1 },
  { question: "Why might we leave the plant to equilibrate before taking readings?", options: ["To dry it", "To allow steady rate after cutting", "To stop transpiration", "To add water"], correctIndex: 1, marks: 1 },
  { question: "The bubble in a potometer moves because:", options: ["The plant pushes it", "Water uptake draws the bubble along", "Gravity only", "Wind only"], correctIndex: 1, marks: 1 },
  { question: "What is the dependent variable in a transpiration investigation?", options: ["Type of plant", "Rate of water uptake (or distance bubble moves)", "Light intensity only", "Humidity only"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Describe how to use a potometer to investigate the effect of light on transpiration.", marks: 3, markScheme: ["Set up potometer with cut shoot under water; introduce air bubble; measure distance moved or water uptake; change light; repeat; control other factors."] },
  { question: "Why is water uptake used as an estimate of transpiration?", marks: 1, markScheme: ["Most water absorbed is lost by transpiration; direct measurement of vapour loss is harder."] },
  { question: "What might cause the rate to be faster?", marks: 1, markScheme: ["Higher light; higher temperature; wind; low humidity."] },
  { question: "Why must we prevent air entering the xylem when setting up?", marks: 1, markScheme: ["Air block would break the water column; stop flow."] },
  { question: "How could you make the investigation more reliable?", marks: 1, markScheme: ["Repeat; same species/size; control variables; calculate mean."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
