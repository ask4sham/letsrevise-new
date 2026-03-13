const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Diabetes";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Diabetes";

const MCQS = [
  { question: "Type 1 diabetes is when:", options: ["Body does not respond to insulin", "Pancreas does not produce (enough) insulin", "Too much insulin", "Only old people get it"], correctIndex: 1, marks: 1 },
  { question: "Type 1 diabetes is usually treated by:", options: ["Diet only", "Insulin injections (or pump); diet", "Only exercise", "Only tablets"], correctIndex: 1, marks: 1 },
  { question: "Type 2 diabetes is when:", options: ["No insulin at all", "Body cells do not respond well to insulin", "Only children get it", "Pancreas is removed"], correctIndex: 1, marks: 1 },
  { question: "Type 2 diabetes risk is increased by:", options: ["Only genetics", "Obesity; poor diet; lack of exercise", "Only age", "Only sugar"], correctIndex: 1, marks: 1 },
  { question: "If blood glucose is not controlled in diabetes:", options: ["No effect", "Damage to organs; coma; long-term health problems", "Only tiredness", "Only thirst"], correctIndex: 1, marks: 1 },
  { question: "Type 2 can be managed by:", options: ["Only insulin", "Diet; exercise; sometimes medication or insulin", "Only surgery", "Only rest"], correctIndex: 1, marks: 1 },
  { question: "Diabetics may need to monitor:", options: ["Only weight", "Blood glucose level", "Only blood pressure", "Only temperature"], correctIndex: 1, marks: 1 },
  { question: "Insulin was discovered by:", options: ["Fleming", "Banting and Best", "Pasteur", "Jenner"], correctIndex: 1, marks: 1 },
  { question: "Which type of diabetes usually starts in childhood?", options: ["Type 2", "Type 1", "Both", "Neither"], correctIndex: 1, marks: 1 },
  { question: "Why might a Type 1 diabetic have an insulin injection after a meal?", options: ["To reduce appetite", "Blood glucose rises after eating; insulin lowers it", "To digest food", "To increase glucose"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the difference between Type 1 and Type 2 diabetes?", marks: 2, markScheme: ["Type 1: pancreas does not produce insulin; usually from young age. Type 2: cells do not respond to insulin; often linked to lifestyle."] },
  { question: "How is Type 1 diabetes treated?", marks: 1, markScheme: ["Insulin injections or pump; control diet; monitor blood glucose."] },
  { question: "Give one way to reduce the risk of Type 2 diabetes.", marks: 1, markScheme: ["Healthy diet; exercise; maintain healthy weight."] },
  { question: "Why do people with Type 1 diabetes need insulin?", marks: 1, markScheme: ["Their pancreas does not produce insulin; without it blood glucose would stay too high."] },
  { question: "What can happen if blood glucose is not well controlled in diabetes?", marks: 1, markScheme: ["Damage to blood vessels/organs; coma; long-term complications."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
