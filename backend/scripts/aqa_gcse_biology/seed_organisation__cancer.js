const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Cancer";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Cancer";

const MCQS = [
  { question: "What is cancer?", options: ["A virus", "Uncontrolled cell division", "A bacterium", "A type of blood cell"], correctIndex: 1, marks: 1 },
  { question: "Tumours can be:", options: ["Only benign", "Benign or malignant", "Only malignant", "Neither"], correctIndex: 1, marks: 1 },
  { question: "A malignant tumour:", options: ["Does not spread", "Can invade other tissues and spread", "Is always harmless", "Only grows slowly"], correctIndex: 1, marks: 1 },
  { question: "Which is a risk factor for cancer?", options: ["Exercise only", "Smoking, UV exposure, some viruses", "Healthy diet only", "Sleep only"], correctIndex: 1, marks: 1 },
  { question: "Benign tumours:", options: ["Always spread", "Do not invade other tissues; usually stay in one place", "Are always fatal", "Are the same as malignant"], correctIndex: 1, marks: 1 },
  { question: "Cancer treatment may include:", options: ["Only surgery", "Surgery, radiotherapy, chemotherapy", "Only diet", "Only rest"], correctIndex: 1, marks: 1 },
  { question: "What causes uncontrolled cell division?", options: ["Only infection", "Changes in genes (mutations); risk factors", "Only diet", "Only age"], correctIndex: 1, marks: 1 },
  { question: "UV radiation from the sun can increase the risk of:", options: ["Only heart disease", "Skin cancer", "Only lung cancer", "Only blood cancer"], correctIndex: 1, marks: 1 },
  { question: "Lifestyle factors that can reduce cancer risk include:", options: ["Smoking", "Not smoking, healthy diet, avoiding excess UV", "Sunbathing only", "No exercise"], correctIndex: 1, marks: 1 },
  { question: "Metastasis means:", options: ["Tumour shrinks", "Cancer spreads to other parts of the body", "Tumour is benign", "Cancer is cured"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is cancer?", marks: 2, markScheme: ["Uncontrolled cell division; forms tumour; can be benign or malignant."] },
  { question: "What is the difference between benign and malignant tumours?", marks: 2, markScheme: ["Benign: do not spread; stay in one place. Malignant: invade and spread (metastasis)."] },
  { question: "Give two risk factors for cancer.", marks: 2, markScheme: ["Smoking; UV exposure; diet; viruses; genetics; alcohol. Any two."] },
  { question: "How can lifestyle choices reduce the risk of cancer?", marks: 1, markScheme: ["Not smoking; healthy diet; avoid excess UV; exercise; limit alcohol."] },
  { question: "Name one type of cancer treatment.", marks: 1, markScheme: ["Surgery; radiotherapy; chemotherapy."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
