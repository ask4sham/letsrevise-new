const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Control of blood glucose concentration";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Control of blood glucose concentration";

const MCQS = [
  { question: "When blood glucose is too high, the pancreas releases:", options: ["Glucagon", "Insulin", "Adrenaline", "Thyroxine"], correctIndex: 1, marks: 1 },
  { question: "Insulin causes:", options: ["Blood glucose to rise", "Cells to take in glucose; liver to store as glycogen", "Only muscles to release glucose", "Only the brain to use glucose"], correctIndex: 1, marks: 1 },
  { question: "When blood glucose is too low, the pancreas releases:", options: ["Insulin", "Glucagon", "Adrenaline only", "Thyroxine"], correctIndex: 1, marks: 1 },
  { question: "Glucagon causes the liver to:", options: ["Store more glycogen", "Convert glycogen to glucose and release it", "Stop releasing glucose", "Only absorb glucose"], correctIndex: 1, marks: 1 },
  { question: "Blood glucose rises after:", options: ["Only exercise", "Eating carbohydrate-rich food", "Only sleeping", "Only drinking water"], correctIndex: 1, marks: 1 },
  { question: "This control is an example of:", options: ["Positive feedback", "Negative feedback", "No feedback", "Only nervous control"], correctIndex: 1, marks: 1 },
  { question: "Glycogen is stored in:", options: ["Only the brain", "Liver and muscles", "Only the pancreas", "Only the blood"], correctIndex: 1, marks: 1 },
  { question: "If no insulin is produced, blood glucose can:", options: ["Fall too low only", "Stay too high (e.g. in Type 1 diabetes)", "Stay normal", "Only rise after food"], correctIndex: 1, marks: 1 },
  { question: "Receptors that detect blood glucose are in:", options: ["Only the brain", "The pancreas", "Only the liver", "Only the muscles"], correctIndex: 1, marks: 1 },
  { question: "Exercise can lower blood glucose because:", options: ["Muscles release glucose", "Muscles use more glucose for respiration", "Liver stops working", "Pancreas stops releasing insulin"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What happens when blood glucose concentration is too high?", marks: 2, markScheme: ["Pancreas releases insulin; cells take in glucose; liver converts glucose to glycogen; level falls."] },
  { question: "What is the role of glucagon?", marks: 1, markScheme: ["Released when blood glucose too low; liver converts glycogen to glucose; releases glucose into blood."] },
  { question: "Why is control of blood glucose important?", marks: 1, markScheme: ["Cells need glucose for respiration; too high or too low is harmful."] },
  { question: "Describe how insulin reduces blood glucose.", marks: 2, markScheme: ["Makes liver and muscle cells take in glucose; liver converts glucose to glycogen for storage."] },
  { question: "What type of feedback is blood glucose control?", marks: 1, markScheme: ["Negative feedback; change triggers response that reverses the change."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
