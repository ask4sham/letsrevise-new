const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Drug development";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Drug development";

const MCQS = [
  { question: "New drugs are tested for:", options: ["Cost only", "Efficacy, toxicity, dosage", "Taste only", "Colour only"], correctIndex: 1, marks: 1 },
  { question: "Preclinical testing is done:", options: ["Only in humans", "In cells and animals first", "Only in plants", "After licensing"], correctIndex: 1, marks: 1 },
  { question: "Clinical trials involve:", options: ["Only animals", "Healthy volunteers and patients", "Only computer models", "No humans"], correctIndex: 1, marks: 1 },
  { question: "Placebo is used to:", options: ["Cure disease", "Compare effect of drug; blind trials", "Replace the drug", "Increase cost"], correctIndex: 1, marks: 1 },
  { question: "Double-blind trials mean:", options: ["No one takes the drug", "Neither patient nor doctor knows who gets drug or placebo", "Two drugs are used", "Trials run twice"], correctIndex: 1, marks: 1 },
  { question: "Why are placebos used in trials?", options: ["To save money", "To compare; see if drug is better than no treatment", "To harm patients", "To speed approval"], correctIndex: 1, marks: 1 },
  { question: "Drug development is expensive because:", options: ["Drugs are cheap", "Research; testing; many compounds fail; trials take years", "Doctors are paid a lot", "Placebos are expensive"], correctIndex: 1, marks: 1 },
  { question: "Toxicity testing checks:", options: ["Only effectiveness", "Whether drug is safe; side effects", "Only taste", "Only colour"], correctIndex: 1, marks: 1 },
  { question: "Peer review of drug trials helps to:", options: ["Speed up sales", "Check validity; reduce bias; ensure quality", "Hide results", "Increase cost"], correctIndex: 1, marks: 1 },
  { question: "Which comes first in drug development?", options: ["Human trials", "Preclinical (cells, animals)", "Licensing", "Mass production"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Describe the stages of testing a new drug.", marks: 2, markScheme: ["Preclinical (cells, animals); then clinical trials (healthy volunteers, then patients); efficacy and toxicity."] },
  { question: "What is a placebo and why is it used?", marks: 2, markScheme: ["Inactive substance; used to compare with drug; see if drug effect is real."] },
  { question: "What is a double-blind trial?", marks: 1, markScheme: ["Neither patient nor doctor knows who receives drug or placebo; reduces bias."] },
  { question: "Why is drug development expensive?", marks: 1, markScheme: ["Research; many compounds fail; lengthy testing; clinical trials."] },
  { question: "Give one reason for peer review in drug development.", marks: 1, markScheme: ["Check validity; reduce bias; ensure results are reliable."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
