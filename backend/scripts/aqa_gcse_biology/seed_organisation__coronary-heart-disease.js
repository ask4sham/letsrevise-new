const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Coronary heart disease";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Coronary heart disease";

const MCQS = [
  { question: "What causes coronary heart disease?", options: ["Lack of exercise only", "Fatty deposits (atheroma) blocking coronary arteries", "Too much water", "Too much oxygen"], correctIndex: 1, marks: 1 },
  { question: "What can happen if a coronary artery is blocked?", options: ["Heart rate increases only", "Heart attack (heart muscle starved of oxygen)", "Blood pressure drops only", "Nothing"], correctIndex: 1, marks: 1 },
  { question: "A stent is used to:", options: ["Replace the heart", "Widen blocked artery; keep it open", "Remove blood", "Cool the heart"], correctIndex: 1, marks: 1 },
  { question: "Statins are drugs that:", options: ["Increase cholesterol", "Reduce cholesterol; reduce risk of heart disease", "Replace blood", "Increase blood pressure"], correctIndex: 1, marks: 1 },
  { question: "Which is a risk factor for heart disease?", options: ["Low fat diet", "Smoking", "Exercise", "Young age"], correctIndex: 1, marks: 1 },
  { question: "A bypass operation:", options: ["Removes the heart", "Uses a blood vessel to bypass a blocked artery", "Replaces valves only", "Fixes capillaries only"], correctIndex: 1, marks: 1 },
  { question: "What is a heart attack?", options: ["Fast heartbeat", "Part of heart muscle dies due to lack of oxygen", "Low blood pressure only", "Valve failure only"], correctIndex: 1, marks: 1 },
  { question: "Lifestyle factors that reduce risk include:", options: ["Smoking", "Balanced diet and exercise", "High salt only", "No exercise"], correctIndex: 1, marks: 1 },
  { question: "Coronary arteries supply:", options: ["The lungs", "The heart muscle", "The brain only", "The liver"], correctIndex: 1, marks: 1 },
  { question: "Cholesterol can contribute to:", options: ["Stronger arteries", "Atheroma / narrowing of arteries", "Lower blood pressure", "Faster blood flow"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What causes coronary heart disease?", marks: 2, markScheme: ["Fatty deposits (atheroma) in coronary arteries; reduce blood flow; heart muscle starved of oxygen."] },
  { question: "Describe one treatment for blocked coronary arteries.", marks: 2, markScheme: ["Stent: tube to widen artery. Statins: reduce cholesterol. Bypass: vessel graft."] },
  { question: "Give two lifestyle factors that increase the risk of heart disease.", marks: 2, markScheme: ["Smoking; poor diet; lack of exercise; obesity; high stress. Any two."] },
  { question: "What is a stent?", marks: 1, markScheme: ["Mesh tube inserted to keep narrowed artery open."] },
  { question: "Why might a person need a heart bypass?", marks: 1, markScheme: ["Coronary artery blocked; bypass allows blood to reach heart muscle."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
