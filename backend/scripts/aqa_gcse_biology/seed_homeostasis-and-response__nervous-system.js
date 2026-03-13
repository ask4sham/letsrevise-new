const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "The nervous system";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "The nervous system";

const MCQS = [
  { question: "The nervous system allows:", options: ["Only growth", "Rapid response to stimuli", "Only digestion", "Only respiration"], correctIndex: 1, marks: 1 },
  { question: "Information is carried as:", options: ["Hormones only", "Electrical impulses along neurones", "Blood only", "Only chemicals"], correctIndex: 1, marks: 1 },
  { question: "The central nervous system (CNS) consists of:", options: ["Only nerves", "Brain and spinal cord", "Only sense organs", "Only muscles"], correctIndex: 1, marks: 1 },
  { question: "Sensory neurones carry impulses from:", options: ["CNS to effectors", "Receptors to CNS", "Muscles to brain", "Brain to receptors"], correctIndex: 1, marks: 1 },
  { question: "Motor neurones carry impulses from:", options: ["Receptors to CNS", "CNS to effectors", "Skin to brain", "Eyes to spinal cord"], correctIndex: 1, marks: 1 },
  { question: "A synapse is:", options: ["A type of muscle", "Gap between neurones; impulse crosses as chemical", "Part of the brain", "A receptor"], correctIndex: 1, marks: 1 },
  { question: "Receptors are found in:", options: ["Only the brain", "Sense organs (e.g. eyes, skin, ears)", "Only the heart", "Only the liver"], correctIndex: 1, marks: 1 },
  { question: "Which type of neurone carries impulses from the eye to the brain?", options: ["Motor", "Sensory", "Relay", "Effector"], correctIndex: 1, marks: 1 },
  { question: "Nervous responses are typically:", options: ["Slow and long-lasting", "Rapid and short-lived", "Only in plants", "Only hormonal"], correctIndex: 1, marks: 1 },
  { question: "Effectors that respond to nervous impulses include:", options: ["Only glands", "Muscles and glands", "Only receptors", "Only neurones"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the role of the central nervous system?", marks: 1, markScheme: ["Coordinates response; receives information from receptors; sends impulses to effectors."] },
  { question: "Describe the pathway of a nervous response from stimulus to response.", marks: 2, markScheme: ["Receptor detects stimulus; sensory neurone to CNS; CNS coordinates; motor neurone to effector; effector responds."] },
  { question: "What is a synapse?", marks: 1, markScheme: ["Gap between two neurones; impulse crosses as chemical (neurotransmitter)."] },
  { question: "What is the difference between sensory and motor neurones?", marks: 2, markScheme: ["Sensory: carry impulses from receptors to CNS. Motor: carry impulses from CNS to effectors."] },
  { question: "Why are nervous responses fast?", marks: 1, markScheme: ["Electrical impulses travel quickly along neurones."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
