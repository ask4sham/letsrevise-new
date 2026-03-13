const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "The brain";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "The brain";

const MCQS = [
  { question: "The brain is responsible for:", options: ["Only breathing", "Consciousness; memory; coordination of many responses", "Only heart rate", "Only digestion"], correctIndex: 1, marks: 1 },
  { question: "The cerebral cortex is involved in:", options: ["Only balance", "Consciousness; language; memory; intelligence", "Only breathing", "Only vision"], correctIndex: 1, marks: 1 },
  { question: "The cerebellum is involved in:", options: ["Only thinking", "Balance; muscle coordination", "Only memory", "Only breathing"], correctIndex: 1, marks: 1 },
  { question: "The medulla controls:", options: ["Only vision", "Unconscious activities (e.g. heartbeat, breathing)", "Only memory", "Only temperature"], correctIndex: 1, marks: 1 },
  { question: "Studying brain function has used:", options: ["Only surgery", "Patients with damage; electrical stimulation; imaging (MRI)", "Only drugs", "Only animals"], correctIndex: 1, marks: 1 },
  { question: "Why is treating brain damage or disease difficult?", options: ["Brain is small", "Complexity; risk of damage; delicate tissue", "Brain has no nerves", "Brain does not heal"], correctIndex: 1, marks: 1 },
  { question: "The brain is protected by:", options: ["Only skin", "Skull and meninges", "Only fluid", "Only blood"], correctIndex: 1, marks: 1 },
  { question: "Which part of the brain controls heart rate and breathing?", options: ["Cerebral cortex", "Medulla", "Cerebellum", "Hypothalamus"], correctIndex: 1, marks: 1 },
  { question: "MRI scans can be used to:", options: ["Only treat disease", "Map brain structure and activity", "Only measure size", "Only see bones"], correctIndex: 1, marks: 1 },
  { question: "The hypothalamus is involved in:", options: ["Only balance", "Temperature regulation; links nervous and endocrine", "Only vision", "Only hearing"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Name three regions of the brain and one function of each.", marks: 2, markScheme: ["Cerebral cortex – consciousness, memory, language. Cerebellum – balance, coordination. Medulla – heartbeat, breathing. (Accept hypothalamus – temperature.)"] },
  { question: "Why is investigating brain function difficult?", marks: 2, markScheme: ["Delicate; risk of damage; complex; ethical issues; use of patients with damage or imaging."] },
  { question: "What is the role of the cerebellum?", marks: 1, markScheme: ["Balance; coordination of voluntary movement."] },
  { question: "How have scientists learned about brain function?", marks: 1, markScheme: ["Studying patients with damage; electrical stimulation; MRI/imaging."] },
  { question: "What protects the brain?", marks: 1, markScheme: ["Skull; meninges; cerebrospinal fluid."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
