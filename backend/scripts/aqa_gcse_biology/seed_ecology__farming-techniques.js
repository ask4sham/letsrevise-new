const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Farming techniques";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Farming techniques";

const MCQS = [
  { question: "Intensive farming aims to:", options: ["Only reduce yield", "Increase yield from same area; high input", "Only organic", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Fertilisers are used to:", options: ["Only kill pests", "Add mineral ions (e.g. nitrates) to soil; increase growth", "Only in water", "Only in organic farming"], correctIndex: 1, marks: 1 },
  { question: "Pesticides can:", options: ["Only help wildlife", "Kill pests; increase yield; but may harm non-target species", "Only in organic", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Organic farming typically avoids:", options: ["Only water", "Artificial fertilisers; synthetic pesticides", "Only seeds", "Only labour"], correctIndex: 1, marks: 1 },
  { question: "Biological control uses:", options: ["Only chemicals", "Natural predators/parasites to control pests", "Only pesticides", "Only fertilisers"], correctIndex: 1, marks: 1 },
  { question: "Monoculture is:", options: ["Growing many species", "Growing one crop over large area", "Only in garden", "Only in organic"], correctIndex: 1, marks: 1 },
  { question: "Disadvantages of monoculture include:", options: ["Only cost", "Pest buildup; soil depletion; less biodiversity", "Only in water", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Crop rotation can help by:", options: ["Only saving seed", "Different crops use different nutrients; reduce pest buildup; legumes fix nitrogen", "Only in one year", "Only in organic"], correctIndex: 1, marks: 1 },
  { question: "Sustainable farming considers:", options: ["Only profit now", "Long-term; soil health; biodiversity; reducing chemicals", "Only yield", "Only one crop"], correctIndex: 1, marks: 1 },
  { question: "Fertiliser runoff can cause:", options: ["Only more growth", "Eutrophication; pollution of water", "Only in soil", "Only in desert"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the difference between intensive and organic farming?", marks: 2, markScheme: ["Intensive: high input (fertilisers, pesticides) for high yield. Organic: avoids artificial fertilisers/synthetic pesticides; more natural methods."] },
  { question: "What is biological control?", marks: 1, markScheme: ["Using natural predators, parasites or pathogens to control pests; reduces need for pesticides."] },
  { question: "Give one advantage and one disadvantage of using pesticides.", marks: 2, markScheme: ["Advantage: kill pests; increase yield. Disadvantage: may harm non-target species; resistance; pollution."] },
  { question: "How can crop rotation help soil and pests?", marks: 1, markScheme: ["Different crops use different nutrients; break pest cycles; legumes can fix nitrogen."] },
  { question: "What is eutrophication and how can fertilisers cause it?", marks: 1, markScheme: ["Excess nutrients in water; algae grow; decay uses oxygen; fertiliser runoff adds nutrients."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
