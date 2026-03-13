const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Structure and function of the nervous system";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Structure and function of the nervous system";

const MCQS = [
  { question: "The brain is part of the:", options: ["Endocrine system", "Central nervous system", "Digestive system", "Circulatory system"], correctIndex: 1, marks: 1 },
  { question: "The spinal cord:", options: ["Only protects nerves", "Relays impulses between brain and body; reflex centre", "Only produces hormones", "Only controls heart"], correctIndex: 1, marks: 1 },
  { question: "Neurones have a long fibre (axon) to:", options: ["Store energy", "Carry electrical impulses over distance", "Digest food", "Produce hormones"], correctIndex: 1, marks: 1 },
  { question: "Myelin sheath:", options: ["Slows impulses", "Insulates; speeds up impulse", "Produces impulses", "Stores neurotransmitters"], correctIndex: 1, marks: 1 },
  { question: "Relay neurones are found in:", options: ["Only sense organs", "CNS; connect sensory and motor neurones", "Only muscles", "Only glands"], correctIndex: 1, marks: 1 },
  { question: "Which type of neurone is only in the CNS?", options: ["Sensory", "Motor", "Relay", "Effector"], correctIndex: 2, marks: 1 },
  { question: "Nerves are:", options: ["Single cells", "Bundles of neurones", "Only in the brain", "Only in muscles"], correctIndex: 1, marks: 1 },
  { question: "The peripheral nervous system includes:", options: ["Only the brain", "Nerves that connect CNS to rest of body", "Only spinal cord", "Only receptors"], correctIndex: 1, marks: 1 },
  { question: "Electrical impulses in neurones are:", options: ["Slow chemical signals", "Rapid electrical signals", "Only in synapses", "Only in effectors"], correctIndex: 1, marks: 1 },
  { question: "Damage to the spinal cord can affect:", options: ["Only digestion", "Movement and sensation below injury", "Only the brain", "Only the heart"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the role of the spinal cord?", marks: 2, markScheme: ["Relays impulses between brain and body; coordinates reflex responses."] },
  { question: "Describe the structure of a neurone that allows rapid transmission.", marks: 2, markScheme: ["Long axon; myelin sheath insulates and speeds up impulse."] },
  { question: "What is a relay neurone and where is it found?", marks: 1, markScheme: ["Connects sensory and motor neurones; found in CNS (brain/spinal cord)."] },
  { question: "What is the peripheral nervous system?", marks: 1, markScheme: ["Nerves that connect the CNS to the rest of the body (receptors, effectors)."] },
  { question: "How does the myelin sheath help nerve transmission?", marks: 1, markScheme: ["Insulates axon; speeds up electrical impulse."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
