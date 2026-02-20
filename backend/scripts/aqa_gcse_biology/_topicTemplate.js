/**
 * Template for a single topic seed. Copy to seed_<unitKey>__<topicKey>.js
 * and fill UNIT_NAME, TOPIC_NAME, UNIT_KEY, TOPIC_LABEL, MCQS (10), SHORT_ANSWER (5).
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Animal and plant cells";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Animal and plant cells";

const MCQS = [
  { question: "Placeholder MCQ 1?", options: ["A", "B", "C", "D"], correctIndex: 0, marks: 1 },
  { question: "Placeholder MCQ 2?", options: ["A", "B", "C", "D"], correctIndex: 1, marks: 1 },
  { question: "Placeholder MCQ 3?", options: ["A", "B", "C", "D"], correctIndex: 2, marks: 1 },
  { question: "Placeholder MCQ 4?", options: ["A", "B", "C", "D"], correctIndex: 3, marks: 1 },
  { question: "Placeholder MCQ 5?", options: ["A", "B", "C", "D"], correctIndex: 0, marks: 1 },
  { question: "Placeholder MCQ 6?", options: ["A", "B", "C", "D"], correctIndex: 1, marks: 1 },
  { question: "Placeholder MCQ 7?", options: ["A", "B", "C", "D"], correctIndex: 2, marks: 1 },
  { question: "Placeholder MCQ 8?", options: ["A", "B", "C", "D"], correctIndex: 3, marks: 1 },
  { question: "Placeholder MCQ 9?", options: ["A", "B", "C", "D"], correctIndex: 0, marks: 1 },
  { question: "Placeholder MCQ 10?", options: ["A", "B", "C", "D"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Placeholder short 1?", marks: 1, markScheme: ["Accept any reasonable answer."] },
  { question: "Placeholder short 2?", marks: 2, markScheme: ["Point 1.", "Point 2."] },
  { question: "Placeholder short 3?", marks: 2, markScheme: ["Point 1.", "Point 2."] },
  { question: "Placeholder short 4?", marks: 1, markScheme: ["Accept any reasonable answer."] },
  { question: "Placeholder short 5?", marks: 2, markScheme: ["Point 1.", "Point 2."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, {
    unitName: UNIT_NAME,
    topicName: TOPIC_NAME,
    unitKey: UNIT_KEY,
    topicLabel: TOPIC_LABEL,
    mcqs: MCQS,
    shortAnswer: SHORT_ANSWER,
  });
}

if (require.main === module) {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  mongoose.connect(MONGO_URI).then(async () => {
    await run(mongoose);
    await mongoose.disconnect();
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, MCQS, SHORT_ANSWER };
