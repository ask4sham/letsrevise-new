const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Role of biotechnology";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Role of biotechnology";

const MCQS = [
  { question: "Biotechnology in food production can involve:", options: ["Only traditional breeding", "Using microorganisms; genetic modification; fermentation", "Only farming", "Only fishing"], correctIndex: 1, marks: 1 },
  { question: "Bacteria can be used to make:", options: ["Only bread", "Yoghurt; cheese; insulin; other products", "Only meat", "Only vegetables"], correctIndex: 1, marks: 1 },
  { question: "Fermentation by yeast produces:", options: ["Only water", "Bread (CO₂); beer/wine (ethanol)", "Only lactic acid", "Only oxygen"], correctIndex: 1, marks: 1 },
  { question: "GM (genetically modified) crops may:", options: ["Only reduce yield", "Be resistant to pests/herbicides; increase yield; reduce need for chemicals", "Only in lab", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Concerns about GM crops include:", options: ["Only cost", "Effect on wildlife; genes spreading; long-term effects; ethics", "Only in water", "Only in soil"], correctIndex: 1, marks: 1 },
  { question: "Biotechnology can help food security by:", options: ["Only reducing food", "Increasing yield; disease resistance; reducing waste", "Only in one country", "Only in lab"], correctIndex: 1, marks: 1 },
  { question: "Mycoprotein (e.g. Quorn) is:", options: ["Only from plants", "Protein from fungus; grown for food", "Only from animals", "Only from bacteria"], correctIndex: 1, marks: 1 },
  { question: "Enzymes from microorganisms are used in:", options: ["Only digestion", "Food production (e.g. cheese; washing powders)", "Only in lab", "Only in medicine"], correctIndex: 1, marks: 1 },
  { question: "Advantages of using microorganisms for food include:", options: ["Only taste", "Fast growth; can use waste; less land; protein-rich", "Only in one place", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Biotechnology can reduce use of:", options: ["Only water", "Pesticides (e.g. GM pest-resistant crops)", "Only fertiliser", "Only land"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Give two examples of how microorganisms are used in food production.", marks: 2, markScheme: ["Yoghurt/cheese (bacteria); bread/beer/wine (yeast); mycoprotein (fungus); enzymes in food processing."] },
  { question: "How might GM crops help increase food production?", marks: 2, markScheme: ["Resistance to pests/disease; tolerance to herbicides; better yield; grow in difficult conditions."] },
  { question: "What is mycoprotein and how is it produced?", marks: 1, markScheme: ["Protein from fungus (e.g. Fusarium); grown in fermenters; used as meat substitute."] },
  { question: "Give one concern about GM crops.", marks: 1, markScheme: ["Effect on non-target species; genes spreading to wild plants; unknown long-term effects; ethics."] },
  { question: "How can biotechnology help food security?", marks: 1, markScheme: ["Increase yield; disease-resistant crops; alternative protein (mycoprotein); reduce waste; less land."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
