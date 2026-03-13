const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Maintaining water and nitrogen balance";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Maintaining water and nitrogen balance";

const MCQS = [
  { question: "Water is lost from the body in:", options: ["Only sweat", "Urine; sweat; breath; faeces", "Only urine", "Only breath"], correctIndex: 1, marks: 1 },
  { question: "The kidneys help to:", options: ["Only digest food", "Filter blood; remove waste (urea); balance water and ions", "Only produce hormones", "Only store urine"], correctIndex: 1, marks: 1 },
  { question: "Urea is produced from:", options: ["Glucose", "Breakdown of excess amino acids in the liver", "Only proteins in diet", "Only water"], correctIndex: 1, marks: 1 },
  { question: "ADH controls:", options: ["Only blood glucose", "Water balance; amount of water reabsorbed by kidneys", "Only temperature", "Only salt"], correctIndex: 1, marks: 1 },
  { question: "If the body is short of water, the pituitary releases more ADH so that:", options: ["More urine produced", "Less urine; more water reabsorbed", "No change", "Only sweat increases"], correctIndex: 1, marks: 1 },
  { question: "Urine contains:", options: ["Only water", "Water; urea; excess ions", "Only glucose", "Only protein"], correctIndex: 1, marks: 1 },
  { question: "Dialysis is used when:", options: ["Heart fails", "Kidneys fail; to filter blood artificially", "Liver fails", "Lungs fail"], correctIndex: 1, marks: 1 },
  { question: "Selective reabsorption in the kidney means:", options: ["Everything is reabsorbed", "Useful substances (e.g. glucose) reabsorbed; waste (urea) removed", "Nothing is reabsorbed", "Only water is reabsorbed"], correctIndex: 1, marks: 1 },
  { question: "Drinking a lot of water leads to:", options: ["Less ADH; more dilute urine", "More ADH; less urine", "No change in urine", "Only more sweat"], correctIndex: 0, marks: 1 },
  { question: "Where is urea made?", options: ["Kidneys", "Liver", "Pancreas", "Lungs"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How do the kidneys help maintain water balance?", marks: 2, markScheme: ["Filter blood; reabsorb useful substances; ADH controls how much water is reabsorbed; excess water excreted in urine."] },
  { question: "Where does urea come from and how is it removed?", marks: 2, markScheme: ["From breakdown of excess amino acids in liver; filtered by kidneys; excreted in urine."] },
  { question: "What is the role of ADH?", marks: 1, markScheme: ["Controls water reabsorption in kidneys; more ADH = more reabsorption = less urine."] },
  { question: "Why might someone need dialysis?", marks: 1, markScheme: ["Kidneys not working; dialysis filters blood to remove waste and balance water/ions."] },
  { question: "Give two ways water is lost from the body.", marks: 1, markScheme: ["Urine; sweat; breath; faeces. Any two."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
