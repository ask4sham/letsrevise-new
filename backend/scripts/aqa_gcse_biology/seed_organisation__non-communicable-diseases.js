const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Non-communicable diseases";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Non-communicable diseases";

const MCQS = [
  { question: "Non-communicable diseases:", options: ["Spread between people", "Do not spread; caused by lifestyle, genetics, etc.", "Are only viral", "Affect only young people"], correctIndex: 1, marks: 1 },
  { question: "Which is a non-communicable disease?", options: ["Flu", "Cancer", "Measles", "TB"], correctIndex: 1, marks: 1 },
  { question: "Risk factors for cardiovascular disease include:", options: ["Only age", "Smoking, poor diet, lack of exercise", "Only genetics", "Only gender"], correctIndex: 1, marks: 1 },
  { question: "Type 2 diabetes is linked to:", options: ["Only infection", "Obesity and poor diet", "Only genetics", "Only youth"], correctIndex: 1, marks: 1 },
  { question: "Cancer is caused by:", options: ["Only viruses", "Uncontrolled cell division; risk factors include lifestyle", "Only bacteria", "Only injury"], correctIndex: 1, marks: 1 },
  { question: "Which lifestyle choice increases risk of many non-communicable diseases?", options: ["Exercise", "Smoking", "Balanced diet", "Sleep"], correctIndex: 1, marks: 1 },
  { question: "Obesity can increase the risk of:", options: ["Only flu", "Type 2 diabetes, heart disease", "Only colds", "Only infection"], correctIndex: 1, marks: 1 },
  { question: "Non-communicable diseases are often:", options: ["Short-term only", "Long-term; can be managed not always cured", "Always cured", "Only in old age"], correctIndex: 1, marks: 1 },
  { question: "Reducing alcohol can lower the risk of:", options: ["Only infection", "Liver disease, some cancers", "Only flu", "Only colds"], correctIndex: 1, marks: 1 },
  { question: "Genetic factors can influence:", options: ["Only communicable disease", "Risk of some non-communicable diseases", "Only pathogens", "Only viruses"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is a non-communicable disease? Give one example.", marks: 2, markScheme: ["Disease that cannot spread between people. E.g. cancer, heart disease, type 2 diabetes."] },
  { question: "Give two lifestyle risk factors for non-communicable disease.", marks: 2, markScheme: ["Smoking; poor diet; lack of exercise; alcohol; obesity. Any two."] },
  { question: "How can diet affect the risk of disease?", marks: 2, markScheme: ["Poor diet → obesity; linked to heart disease, type 2 diabetes; high salt → blood pressure."] },
  { question: "Why are non-communicable diseases a major health issue?", marks: 1, markScheme: ["Long-term; costly; reduce quality of life; many deaths."] },
  { question: "Name one way to reduce the risk of cardiovascular disease.", marks: 1, markScheme: ["Don't smoke; exercise; balanced diet; healthy weight."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
