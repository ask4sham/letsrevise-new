const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Osmosis";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Osmosis";

const MCQS = [
  { question: "What is osmosis?", options: ["Movement of any particle", "Movement of water from dilute to concentrated solution through partially permeable membrane", "Movement of sugar", "Active transport of water"], correctIndex: 1, marks: 1 },
  { question: "Osmosis involves the movement of:", options: ["Sugar only", "Water only", "Any solute", "Protein only"], correctIndex: 1, marks: 1 },
  { question: "What type of membrane is involved in osmosis?", options: ["Fully permeable", "Partially permeable", "Impermeable", "No membrane"], correctIndex: 1, marks: 1 },
  { question: "Water moves in osmosis from:", options: ["Concentrated to dilute solution", "Dilute to concentrated solution", "Equal solutions only", "No movement"], correctIndex: 1, marks: 1 },
  { question: "A plant cell in dilute solution will:", options: ["Shrink", "Become turgid", "Burst", "Lose water only"], correctIndex: 1, marks: 1 },
  { question: "When a plant cell loses water and the membrane pulls away from the wall, the cell is:", options: ["Turgid", "Plasmolysed", "Normal", "Dividing"], correctIndex: 1, marks: 1 },
  { question: "Does osmosis require energy from respiration?", options: ["Yes", "No", "Only in plants", "Only in animals"], correctIndex: 1, marks: 1 },
  { question: "Animal cells in a concentrated solution may:", options: ["Swell", "Shrink (crenate)", "Stay the same", "Divide"], correctIndex: 1, marks: 1 },
  { question: "Turgor pressure in plants is caused by:", options: ["Water leaving the vacuole", "Water entering the vacuole and pushing against the cell wall", "Sugar leaving", "No water movement"], correctIndex: 1, marks: 1 },
  { question: "Which solution has a higher water concentration?", options: ["Concentrated sugar solution", "Dilute sugar solution", "Pure sugar", "They are equal"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is osmosis?", marks: 2, markScheme: ["Movement of water; from dilute to concentrated solution; through partially permeable membrane."] },
  { question: "Why does a plant cell become turgid in dilute solution?", marks: 2, markScheme: ["Water enters by osmosis; vacuole swells; pushes against cell wall."] },
  { question: "What happens to an animal cell in a concentrated solution?", marks: 1, markScheme: ["Water leaves by osmosis; cell shrinks / crenates."] },
  { question: "What is a partially permeable membrane?", marks: 1, markScheme: ["Membrane that allows some substances (e.g. water) through but not others."] },
  { question: "State what is meant by plasmolysis.", marks: 1, markScheme: ["When plant cell loses water and membrane pulls away from cell wall."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
