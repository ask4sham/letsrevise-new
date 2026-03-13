const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Required Practical: Enzymes";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Required Practical: Enzymes";

const MCQS = [
  { question: "In the enzyme practical we might investigate the effect of:", options: ["Light", "pH or temperature on enzyme rate", "Sound", "Pressure only"], correctIndex: 1, marks: 1 },
  { question: "Why use a water bath?", options: ["To cool only", "To control temperature", "To add water", "To stir"], correctIndex: 1, marks: 1 },
  { question: "What might we measure to show enzyme activity?", options: ["Colour", "Time for substrate to disappear or product to form", "Mass only", "Volume only"], correctIndex: 1, marks: 1 },
  { question: "Why repeat the investigation?", options: ["To use more enzyme", "To improve reliability and calculate mean", "To change pH", "To heat more"], correctIndex: 1, marks: 1 },
  { question: "Controlling variables means:", options: ["Changing all factors", "Keeping other factors constant", "Only measuring one thing", "Ignoring temperature"], correctIndex: 1, marks: 1 },
  { question: "Iodine solution can test for:", options: ["Protein", "Starch (turns blue-black)", "Lipid", "Glucose only"], correctIndex: 1, marks: 1 },
  { question: "When starch is broken down by amylase:", options: ["Iodine stays blue-black", "Iodine no longer blue-black (starch gone)", "pH increases only", "Temperature drops"], correctIndex: 1, marks: 1 },
  { question: "What is the independent variable?", options: ["What we measure", "What we change (e.g. pH or temperature)", "What we keep same", "The enzyme"], correctIndex: 1, marks: 1 },
  { question: "What is the dependent variable?", options: ["What we change", "What we measure (e.g. time or rate)", "What we control", "The substrate"], correctIndex: 1, marks: 1 },
  { question: "Why use a buffer solution?", options: ["To heat", "To control pH", "To add enzyme", "To cool"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Describe how to investigate the effect of pH on enzyme activity.", marks: 3, markScheme: ["Use buffer solutions; same temp/concentration; measure time for substrate to go or product to form; repeat."] },
  { question: "Why must other variables be controlled?", marks: 1, markScheme: ["So only the factor being tested affects the result; fair test."] },
  { question: "What is the purpose of repeating the experiment?", marks: 1, markScheme: ["Improve reliability; calculate mean; spot anomalies."] },
  { question: "Name one way to measure the rate of an enzyme reaction.", marks: 1, markScheme: ["Time for substrate to disappear; amount of product formed; rate = 1/time."] },
  { question: "What is a control in this investigation?", marks: 1, markScheme: ["Tube without enzyme or with denatured enzyme; shows no reaction without enzyme."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
