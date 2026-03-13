const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Required Practical: Reaction time";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Required Practical: Reaction time";

const MCQS = [
  { question: "Reaction time is the time between:", options: ["Stimulus and response", "Two stimuli", "Two responses", "Thinking and sleeping"], correctIndex: 0, marks: 1 },
  { question: "In the ruler drop test, the stimulus is:", options: ["Catching the ruler", "Ruler being released", "Ruler hitting the floor", "Person closing eyes"], correctIndex: 1, marks: 1 },
  { question: "Reaction time can be affected by:", options: ["Only age", "Caffeine; practice; tiredness; distractions", "Only height", "Only weight"], correctIndex: 1, marks: 1 },
  { question: "Why repeat the test several times?", options: ["To waste time", "To get a more reliable average", "To use more rulers", "To slow reaction"], correctIndex: 1, marks: 1 },
  { question: "The ruler drop test involves:", options: ["Only the brain", "Eye (receptor); sensory neurone; CNS; motor neurone; muscle (effector)", "Only the hand", "Only the ruler"], correctIndex: 1, marks: 1 },
  { question: "A shorter distance caught on the ruler means:", options: ["Slower reaction", "Faster reaction", "No difference", "Ruler is longer"], correctIndex: 1, marks: 1 },
  { question: "Conversion tables or equations are used to:", options: ["Measure the ruler", "Convert distance to time (seconds)", "Count catches", "Weigh the ruler"], correctIndex: 1, marks: 1 },
  { question: "What could make results more valid?", options: ["Only one attempt", "Same person; same conditions; discard anomalies", "Different rulers each time", "No practice"], correctIndex: 1, marks: 1 },
  { question: "Reaction time involves the:", options: ["Endocrine system only", "Nervous system", "Digestive system only", "Circulatory system only"], correctIndex: 1, marks: 1 },
  { question: "Why might the person being tested not see the ruler release?", options: ["To make it harder", "To remove effect of predicting; test true reaction", "To save ruler", "To use sound only"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is reaction time and how can it be measured with a ruler?", marks: 2, markScheme: ["Time between stimulus and response. Ruler dropped; measure distance caught; convert to time using table/equation."] },
  { question: "Why should the test be repeated?", marks: 1, markScheme: ["To get an average; more reliable; reduce effect of anomalies."] },
  { question: "Describe the pathway from stimulus to response in the ruler drop test.", marks: 2, markScheme: ["Eye sees ruler drop (receptor); sensory neurone; CNS; motor neurone; muscle catches (effector)."] },
  { question: "Give one factor that could affect reaction time.", marks: 1, markScheme: ["Caffeine; tiredness; practice; age; distractions."] },
  { question: "What does a shorter distance on the ruler indicate?", marks: 1, markScheme: ["Faster reaction time (less time for ruler to fall)."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
