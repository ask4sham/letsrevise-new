const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Required Practical: Ecosystems";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Required Practical: Ecosystems";

const MCQS = [
  { question: "In the ecosystems practical, quadrats are used to:", options: ["Count all organisms", "Sample organisms in a defined area", "Only measure temperature", "Only measure light"], correctIndex: 1, marks: 1 },
  { question: "Random sampling is used to:", options: ["Choose only one area", "Avoid bias; give representative estimate", "Only in water", "Only for plants"], correctIndex: 1, marks: 1 },
  { question: "To estimate population size you might use:", options: ["Only one quadrat", "Number in quadrat × (total area / quadrat area)", "Only count once", "Only count animals"], correctIndex: 1, marks: 1 },
  { question: "A transect is used to:", options: ["Only sample randomly", "Sample along a line; see how distribution changes", "Only count species", "Only in lab"], correctIndex: 1, marks: 1 },
  { question: "Percentage cover in a quadrat is:", options: ["Only count of individuals", "Estimate of area covered by a species", "Only for animals", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Why use many quadrats?", options: ["To save time", "More reliable estimate; reduce effect of chance", "Only one is needed", "Only for small areas"], correctIndex: 1, marks: 1 },
  { question: "Abundance can be measured using:", options: ["Only weight", "Count; percentage cover; ACFOR scale", "Only temperature", "Only pH"], correctIndex: 1, marks: 1 },
  { question: "Belt transect uses:", options: ["Only one quadrat", "Quadrats placed along a line at intervals", "Only random placement", "Only for water"], correctIndex: 1, marks: 1 },
  { question: "To compare two areas you should:", options: ["Use different methods", "Use same method; same size quadrat; enough samples", "Only sample one area", "Only count plants"], correctIndex: 1, marks: 1 },
  { question: "Distribution means:", options: ["Only how many", "Where organisms are found; pattern", "Only in one place", "Only abundance"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How can quadrats be used to estimate the population of a species?", marks: 2, markScheme: ["Place quadrats randomly (or at intervals); count individuals (or % cover) in each; mean per quadrat × (total area / quadrat area)."] },
  { question: "Why is random sampling important?", marks: 1, markScheme: ["Avoids bias; gives representative sample; can generalise to whole area."] },
  { question: "What is a transect and when might you use it?", marks: 2, markScheme: ["Line across area; place quadrats along it. Use when studying change in distribution (e.g. from shade to sun)."] },
  { question: "Give one way to make the estimate more reliable.", marks: 1, markScheme: ["Use more quadrats; random placement; same size quadrats; repeat."] },
  { question: "What is percentage cover?", marks: 1, markScheme: ["Estimate of the proportion of the quadrat area covered by a species (e.g. plants)."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
