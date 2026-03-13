const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "The reflex arc";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "The reflex arc";

const MCQS = [
  { question: "A reflex is:", options: ["A slow voluntary response", "Rapid automatic response to stimulus", "Only in the brain", "A learned response"], correctIndex: 1, marks: 1 },
  { question: "Reflexes do not involve:", options: ["The spinal cord", "The conscious part of the brain", "Sensory neurones", "Motor neurones"], correctIndex: 1, marks: 1 },
  { question: "The reflex arc goes:", options: ["Brain first", "Receptor → sensory → relay → motor → effector", "Effector to receptor", "Only through the brain"], correctIndex: 1, marks: 1 },
  { question: "Why are reflexes important?", options: ["To think slowly", "To protect the body quickly (e.g. from harm)", "To learn", "To digest food"], correctIndex: 1, marks: 1 },
  { question: "Touching a sharp object triggers:", options: ["Only pain", "Reflex to withdraw hand", "Only sensation", "Only thought"], correctIndex: 1, marks: 1 },
  { question: "The relay neurone in a reflex is in the:", options: ["Skin", "Spinal cord (or CNS)", "Muscle", "Eye"], correctIndex: 1, marks: 1 },
  { question: "Reflexes are faster than voluntary responses because:", options: ["They use hormones", "Fewer synapses; no conscious decision", "They use the brain more", "They are weaker"], correctIndex: 1, marks: 1 },
  { question: "In a reflex, the effector might be:", options: ["Only the eye", "A muscle (e.g. arm muscle)", "Only a gland", "Only the brain"], correctIndex: 1, marks: 1 },
  { question: "Which is an example of a reflex?", options: ["Choosing to run", "Pupil contracting in bright light", "Reading a book", "Speaking"], correctIndex: 1, marks: 1 },
  { question: "The receptor in a reflex detects:", options: ["Only light", "The stimulus (e.g. pain, light)", "Only sound", "Only chemicals"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Describe the pathway of a reflex arc.", marks: 2, markScheme: ["Receptor → sensory neurone → relay neurone (CNS) → motor neurone → effector."] },
  { question: "Why do reflexes not involve the conscious brain?", marks: 1, markScheme: ["They are automatic; coordinated by spinal cord; faster for protection."] },
  { question: "Give one example of a reflex and why it is useful.", marks: 2, markScheme: ["E.g. withdrawing hand from sharp object – protects from injury. Or pupil reflex – protects retina."] },
  { question: "Why might a reflex be faster than a voluntary response?", marks: 1, markScheme: ["Fewer synapses; no conscious processing; direct pathway through spinal cord."] },
  { question: "What is the role of the relay neurone in a reflex?", marks: 1, markScheme: ["Connects sensory to motor neurone; in spinal cord/CNS."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
