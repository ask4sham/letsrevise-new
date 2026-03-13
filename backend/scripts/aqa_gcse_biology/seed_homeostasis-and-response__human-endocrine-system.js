const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Human endocrine system";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Human endocrine system";

const MCQS = [
  { question: "Hormones are secreted by:", options: ["Nerves", "Glands (endocrine)", "Only the brain", "Only muscles"], correctIndex: 1, marks: 1 },
  { question: "Hormones are carried in the:", options: ["Nerves", "Blood", "Only lymph", "Only saliva"], correctIndex: 1, marks: 1 },
  { question: "Hormonal responses are generally:", options: ["Faster than nervous", "Slower and longer-lasting than nervous", "Only in the brain", "Only for movement"], correctIndex: 1, marks: 1 },
  { question: "The pituitary gland:", options: ["Only controls growth", "Produces many hormones; 'master gland'; controls other glands", "Only controls blood sugar", "Only in the pancreas"], correctIndex: 1, marks: 1 },
  { question: "Insulin is produced by:", options: ["Liver", "Pancreas", "Thyroid", "Adrenal"], correctIndex: 1, marks: 1 },
  { question: "The thyroid produces thyroxine which controls:", options: ["Only blood sugar", "Metabolic rate", "Only growth", "Only water balance"], correctIndex: 1, marks: 1 },
  { question: "Adrenal glands produce adrenaline which:", options: ["Lowers heart rate", "Increases heart rate; fight or flight", "Only digests food", "Only stores glucose"], correctIndex: 1, marks: 1 },
  { question: "Ovaries and testes produce:", options: ["Only adrenaline", "Sex hormones (oestrogen, testosterone)", "Only insulin", "Only thyroxine"], correctIndex: 1, marks: 1 },
  { question: "Endocrine glands release hormones:", options: ["Into ducts", "Directly into the blood", "Only into the gut", "Only into the brain"], correctIndex: 1, marks: 1 },
  { question: "Hormones affect:", options: ["Only the organ that made them", "Target organs (specific cells have receptors)", "All cells", "Only the blood"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the difference between nervous and hormonal communication?", marks: 2, markScheme: ["Nervous: electrical, fast, short-lived. Hormonal: chemical in blood, slower, longer-lasting."] },
  { question: "Where is insulin produced and what does it do?", marks: 2, markScheme: ["Pancreas; reduces blood glucose level; makes cells take in glucose; liver stores as glycogen."] },
  { question: "What is the role of the pituitary gland?", marks: 1, markScheme: ["Produces many hormones; controls other glands; e.g. growth hormone; 'master gland'."] },
  { question: "Name one hormone and the gland that produces it.", marks: 1, markScheme: ["E.g. insulin – pancreas; adrenaline – adrenal; thyroxine – thyroid; oestrogen – ovary."] },
  { question: "How do hormones reach their target organs?", marks: 1, markScheme: ["Secreted into blood; carried in blood; target cells have receptors."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
