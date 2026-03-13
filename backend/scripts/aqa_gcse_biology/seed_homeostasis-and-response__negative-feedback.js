const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Negative feedback";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Negative feedback";

const MCQS = [
  { question: "Negative feedback means:", options: ["A change is increased", "A change triggers a response that reverses the change", "No response occurs", "Only positive effects"], correctIndex: 1, marks: 1 },
  { question: "Blood glucose control is an example of negative feedback because:", options: ["Glucose only rises", "High glucose triggers insulin to lower it; low triggers glucagon to raise it", "Glucose never changes", "Only insulin is used"], correctIndex: 1, marks: 1 },
  { question: "Body temperature control uses negative feedback when:", options: ["Temperature only rises", "Too hot triggers cooling; too cold triggers warming", "Temperature is ignored", "Only sweating occurs"], correctIndex: 1, marks: 1 },
  { question: "In negative feedback, the response:", options: ["Increases the stimulus", "Counteracts the stimulus / brings level back", "Stops all control", "Only happens once"], correctIndex: 1, marks: 1 },
  { question: "Water balance (ADH) is negative feedback because:", options: ["More water always causes more ADH", "Low water → more ADH → more reabsorption; high water → less ADH → more urine", "ADH has no effect", "Only kidneys respond"], correctIndex: 1, marks: 1 },
  { question: "Which is NOT an example of negative feedback?", options: ["Blood glucose control", "Temperature control", "A change that amplifies itself (e.g. childbirth oxytocin)", "Water balance"], correctIndex: 2, marks: 1 },
  { question: "Receptors in negative feedback detect:", options: ["Only the response", "The level of the factor (e.g. glucose, temperature)", "Only the effector", "Only the brain"], correctIndex: 1, marks: 1 },
  { question: "Negative feedback helps to:", options: ["Only increase levels", "Maintain stability (homeostasis)", "Only decrease levels", "Stop all regulation"], correctIndex: 1, marks: 1 },
  { question: "After a meal, blood glucose rises; the response is:", options: ["Release glucagon", "Release insulin to lower glucose (negative feedback)", "No response", "Release more glucose"], correctIndex: 1, marks: 1 },
  { question: "When the factor returns to normal, the corrective response:", options: ["Increases", "Decreases or stops (so level stays stable)", "Stays maximum", "Only in the brain"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is negative feedback?", marks: 1, markScheme: ["A change in a factor triggers a response that reverses the change; restores normal level."] },
  { question: "Give one example of negative feedback in the body and explain it.", marks: 2, markScheme: ["E.g. blood glucose: high → insulin → glucose falls. Low → glucagon → glucose rises. Or temperature: hot → vasodilation, sweating. Cold → vasoconstriction, shivering."] },
  { question: "Why is negative feedback important for homeostasis?", marks: 1, markScheme: ["Keeps internal conditions stable; reverses changes so levels return to normal."] },
  { question: "In blood glucose control, what happens when the level returns to normal?", marks: 1, markScheme: ["Insulin or glucagon release decreases; negative feedback reduces the corrective response."] },
  { question: "Name one factor controlled by negative feedback.", marks: 1, markScheme: ["Blood glucose; body temperature; water balance; etc."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
