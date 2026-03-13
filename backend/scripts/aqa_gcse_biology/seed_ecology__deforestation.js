const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Deforestation";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Deforestation";

const MCQS = [
  { question: "Deforestation is:", options: ["Planting trees", "Clearing forests (cutting down trees)", "Only in one country", "Only in winter"], correctIndex: 1, marks: 1 },
  { question: "Deforestation can increase CO₂ in the atmosphere because:", options: ["Trees absorb more CO₂", "Fewer trees to absorb CO₂; burning releases CO₂; decay releases CO₂", "Only in water", "Only in soil"], correctIndex: 1, marks: 1 },
  { question: "Deforestation reduces biodiversity because:", options: ["More species move in", "Habitat destroyed; many species lose home", "Only in one place", "Only plants are affected"], correctIndex: 1, marks: 1 },
  { question: "Forests are cleared for:", options: ["Only conservation", "Farming; timber; roads; mining; housing", "Only wildlife", "Only water"], correctIndex: 1, marks: 1 },
  { question: "Deforestation can affect the water cycle by:", options: ["Only increasing rain", "Less transpiration; less rainfall; more runoff; flooding or drought", "Only in ocean", "Only in desert"], correctIndex: 1, marks: 1 },
  { question: "Soil erosion can increase after deforestation because:", options: ["Roots hold more soil", "Tree roots no longer hold soil; rain washes it away", "Only in water", "Only in winter"], correctIndex: 1, marks: 1 },
  { question: "Burning forest for land release:", options: ["Only oxygen", "CO₂; other greenhouse gases", "Only nitrogen", "Only water"], correctIndex: 1, marks: 1 },
  { question: "Reducing deforestation might involve:", options: ["Only more cutting", "Sustainable forestry; protection; replanting; reducing demand", "Only in one country", "Only in cities"], correctIndex: 1, marks: 1 },
  { question: "Deforestation contributes to climate change mainly by:", options: ["Only cooling", "Releasing CO₂; reducing CO₂ uptake", "Only in ocean", "Only in soil"], correctIndex: 1, marks: 1 },
  { question: "Many drugs and resources come from forests, so deforestation:", options: ["Only helps", "May lose potential resources; species lost", "Only in one place", "Only in labs"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How does deforestation increase the amount of CO₂ in the atmosphere?", marks: 2, markScheme: ["Fewer trees to absorb CO₂ by photosynthesis; burning trees releases CO₂; decay of dead matter releases CO₂."] },
  { question: "Give two negative effects of deforestation on the environment.", marks: 2, markScheme: ["Loss of biodiversity; more CO₂ (climate change); soil erosion; disruption of water cycle; flooding."] },
  { question: "Why does deforestation reduce biodiversity?", marks: 1, markScheme: ["Destroys habitat; many species depend on forest; loss of food and shelter."] },
  { question: "Give one way to reduce the impact of deforestation.", marks: 1, markScheme: ["Sustainable forestry; replanting; protect areas; reduce demand for products that drive it."] },
  { question: "How can deforestation affect the water cycle?", marks: 1, markScheme: ["Less transpiration; can change rainfall patterns; more runoff; risk of flooding or drought."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
