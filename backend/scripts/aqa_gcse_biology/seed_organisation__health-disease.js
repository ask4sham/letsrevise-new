const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Health and disease";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Health and disease";

const MCQS = [
  { question: "Health is defined as:", options: ["Absence of disease only", "Physical and mental well-being", "Only fitness", "Only diet"], correctIndex: 1, marks: 1 },
  { question: "A communicable disease:", options: ["Cannot spread", "Can spread between organisms", "Is only genetic", "Affects only plants"], correctIndex: 1, marks: 1 },
  { question: "Which is a communicable disease?", options: ["Cancer", "Flu (virus)", "Diabetes type 2", "Heart disease"], correctIndex: 1, marks: 1 },
  { question: "Which is a non-communicable disease?", options: ["Measles", "TB", "Cardiovascular disease", "COVID-19"], correctIndex: 2, marks: 1 },
  { question: "Risk factors for disease can be:", options: ["Only genetic", "Lifestyle and genetic", "Only environmental", "None"], correctIndex: 1, marks: 1 },
  { question: "Poor diet can increase the risk of:", options: ["Only infection", "Obesity, heart disease, type 2 diabetes", "Only flu", "Only colds"], correctIndex: 1, marks: 1 },
  { question: "What is a pathogen?", options: ["A medicine", "An organism that causes disease", "A type of cell", "A vitamin"], correctIndex: 1, marks: 1 },
  { question: "Disease can affect:", options: ["Only humans", "Organisms and their communities", "Only animals", "Only plants"], correctIndex: 1, marks: 1 },
  { question: "Which factor can reduce the risk of some diseases?", options: ["Smoking", "Regular exercise", "Poor diet", "No sleep"], correctIndex: 1, marks: 1 },
  { question: "Interactions between diseases mean:", options: ["One disease never affects another", "One disease can make another more likely or worse", "All diseases are the same", "No link"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the difference between communicable and non-communicable disease?", marks: 2, markScheme: ["Communicable: can spread (pathogens). Non-communicable: cannot spread; often lifestyle/genetic."] },
  { question: "Give two factors that can affect health.", marks: 2, markScheme: ["Diet; exercise; stress; genetics; environment; pathogens. Any two."] },
  { question: "What is a pathogen?", marks: 1, markScheme: ["Organism that causes disease; e.g. virus, bacterium, fungus."] },
  { question: "Give one example of a lifestyle risk factor for disease.", marks: 1, markScheme: ["Smoking; poor diet; lack of exercise; alcohol; obesity."] },
  { question: "What is meant by health?", marks: 1, markScheme: ["Physical and mental well-being; not just absence of disease."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
