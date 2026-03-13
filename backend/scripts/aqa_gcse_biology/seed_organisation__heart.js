const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Heart";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Heart";

const MCQS = [
  { question: "Which chamber pumps blood to the body?", options: ["Right atrium", "Left ventricle", "Right ventricle", "Left atrium"], correctIndex: 1, marks: 1 },
  { question: "Which chamber receives blood from the lungs?", options: ["Right atrium", "Left atrium", "Right ventricle", "Vena cava"], correctIndex: 1, marks: 1 },
  { question: "The right ventricle pumps blood to:", options: ["Body", "Lungs", "Left atrium", "Aorta"], correctIndex: 1, marks: 1 },
  { question: "What prevents backflow of blood in the heart?", options: ["Arteries", "Valves", "Capillaries", "Atria"], correctIndex: 1, marks: 1 },
  { question: "Which vessel brings deoxygenated blood to the heart?", options: ["Aorta", "Pulmonary vein", "Vena cava", "Pulmonary artery"], correctIndex: 2, marks: 1 },
  { question: "The left side of the heart has thicker muscle because:", options: ["It pumps to the lungs", "It pumps to the whole body (higher pressure)", "It receives blood", "It has no valves"], correctIndex: 1, marks: 1 },
  { question: "Where does oxygenated blood enter the heart?", options: ["Vena cava", "Left atrium (from pulmonary vein)", "Right atrium", "Aorta"], correctIndex: 1, marks: 1 },
  { question: "Coronary arteries supply:", options: ["The lungs", "The heart muscle with oxygen", "The brain only", "The liver"], correctIndex: 1, marks: 1 },
  { question: "Which valve is between left atrium and left ventricle?", options: ["Tricuspid", "Bicuspid (mitral)", "Aortic", "Pulmonary"], correctIndex: 1, marks: 1 },
  { question: "Blood in the right ventricle is:", options: ["Oxygenated", "Deoxygenated", "Mixed", "None"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Name the four chambers of the heart.", marks: 1, markScheme: ["Left and right atrium; left and right ventricle."] },
  { question: "Describe the path of blood from the body to the lungs.", marks: 2, markScheme: ["Vena cava → right atrium → right ventricle → pulmonary artery → lungs."] },
  { question: "Why does the left ventricle have a thicker wall than the right?", marks: 1, markScheme: ["Pumps blood to whole body; needs higher pressure."] },
  { question: "What is the role of heart valves?", marks: 1, markScheme: ["Prevent backflow of blood."] },
  { question: "What are coronary arteries?", marks: 1, markScheme: ["Arteries that supply the heart muscle with oxygen and nutrients."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
